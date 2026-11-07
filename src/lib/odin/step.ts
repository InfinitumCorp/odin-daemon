import { attachForecasts } from "./conjure.ts";
import { draftAzrail, resolveAzrail } from "./models/azrail.ts";
import { airframe } from "./models/index.ts";
import { slugRelay, weakestLink } from "./models/slug.ts";
import { fnv1a, take } from "./rng.ts";
import type {
  Coa,
  Command,
  SimEvent,
  Track,
  Vec2,
  World,
} from "./types.ts";

const TRACK_COAST_S = 14;

export function stepWorld(input: World, commands: Command[] = []): World {
  const w = structuredClone(input) as World;
  applyCommands(w, commands);
  moveContacts(w);
  moveAssets(w);
  updateLinks(w);
  fuse(w, measure(w));
  draftEngagements(w);
  resolveEngagements(w);
  drainAndRecover(w);
  w.coas = draftCoas(w);
  attachForecasts(w);
  w.suppress = w.suppress.filter((s) => s.until > w.tick);
  if (w.events.length > 48) w.events.splice(0, w.events.length - 48);
  w.tick += 1;
  return w;
}

export function runSteps(world: World, steps: number, commands: Command[]): World {
  let w = world;
  const n = Math.max(1, Math.min(12, Math.floor(steps)));
  for (let i = 0; i < n; i++) w = stepWorld(w, i === 0 ? commands : []);
  return w;
}

function applyCommands(w: World, commands: Command[]): void {
  for (const command of commands) {
    if (command.type === "roe") {
      w.roe = command.roe;
      note(w, "act", `ROE ${command.roe}. ${command.roe === "HOLD" ? "Resolutions frozen." : "Approved shots may resolve."}`);
    } else if (command.type === "approve") {
      const engagement = w.engagements.find((e) => e.id === command.engagementId && e.state === "pending");
      if (!engagement) continue;
      engagement.state = "approved";
      const shooter = w.assets.find((a) => a.id === engagement.shooterId);
      if (shooter) {
        const track = w.tracks.find((t) => t.id === engagement.trackId);
        shooter.task = {
          kind: "intercept",
          targetId: engagement.trackId,
          waypoint: track ? { ...track.pos } : { ...shooter.pos },
        };
      }
      note(w, "act", `${engagement.shooterId} cleared against ${engagement.trackId}.${w.roe === "HOLD" ? " Blocked while HOLD." : " Cleared to close."}`);
    } else if (command.type === "deny") {
      const engagement = w.engagements.find((e) => e.id === command.engagementId && e.state === "pending");
      if (!engagement) continue;
      engagement.state = "denied";
      w.suppress.push({
        key: `${engagement.shooterId}:${engagement.trackId}`,
        until: w.tick + 40,
      });
      note(w, "info", `${engagement.id} denied. ${engagement.shooterId} will not re-ask that track for 40s.`);
    } else if (command.type === "launch") {
      const asset = w.assets.find((a) => a.id === command.assetId && a.status === "docked");
      const frame = asset ? airframe(asset.klass) : undefined;
      if (!asset || !frame?.launchable) continue;
      asset.status = "airborne";
      asset.battery = Math.max(asset.battery, 0.95);
      asset.pos = { x: asset.home.x + 40, y: asset.home.y + 40 };
      asset.task = frame.launchTask(asset, cell(w, w.assets.indexOf(asset)));
      note(w, "info", `${asset.callsign} launched from FLOWER via the ${frame.klass} backend.`);
    } else if (command.type === "adopt") {
      const coa = w.coas.find((c) => c.id === command.coaId);
      if (!coa) continue;
      for (const assignment of coa.tasks) {
        const asset = w.assets.find((a) => a.id === assignment.assetId);
        if (!asset || asset.status === "fixed" || asset.status === "docked") continue;
        if (asset.task?.kind === "intercept" || asset.task?.kind === "rtb") continue;
        asset.task = structuredClone(assignment.task);
      }
      note(w, "act", `ARCHITECT adopted “${coa.title}”. Intercepts still need their own approval.`);
    }
  }
}

function moveContacts(w: World): void {
  const objective = w.regions.find((r) => r.kind === "objective");
  for (const contact of w.contacts) {
    if (!contact.alive) continue;
    const wp = contact.route[Math.min(contact.routeI, contact.route.length - 1)];
    steer(contact, wp, contact.speed, w.dt);
    if (dist(contact.pos, wp) < 50 && contact.routeI < contact.route.length - 1) contact.routeI += 1;
    if (!contact.flagged && objective) {
      const center = { x: objective.x + objective.w / 2, y: objective.y + objective.h / 2 };
      if (dist(contact.pos, center) < 140) {
        contact.flagged = true;
        note(w, "warn", `${contact.id} crossed ${objective.name}. No casualty model — air picture only.`);
      }
    }
  }
}

function moveAssets(w: World): void {
  for (const asset of w.assets) {
    if (asset.status === "fixed" || asset.status === "docked" || asset.speed <= 0) {
      asset.vel = { x: 0, y: 0 };
      continue;
    }
    const aim = airframe(asset.klass).aim(w, asset);
    steer(asset, aim, asset.speed, w.dt);
    asset.pos.x = clamp(asset.pos.x, 40, w.bounds.w - 40);
    asset.pos.y = clamp(asset.pos.y, 40, w.bounds.h - 40);
    asset.heading = Math.atan2(asset.vel.x, asset.vel.y);
    if (asset.task?.kind === "search" && asset.task.queue && asset.task.queue.length > 0) {
      if (dist(asset.pos, asset.task.waypoint) < 140) {
        asset.task.waypoint = asset.task.queue.shift()!;
      }
    }
    if (asset.task?.kind === "rtb" && dist(asset.pos, asset.home) < 46) {
      asset.status = airframe(asset.klass).recover === "cap" ? "airborne" : "docked";
      asset.task = asset.status === "docked" ? null : { kind: "loiter", waypoint: { ...asset.home } };
      asset.pos = { ...asset.home };
      note(w, "info", `${asset.callsign} recovered at home.`);
    }
  }
}

interface Meas {
  pos: Vec2;
  klass: Track["klass"];
  from: string;
  sigma: number;
}

function measure(w: World): Meas[] {
  const out: Meas[] = [];
  for (const asset of w.assets) {
    if (asset.status === "docked") continue;
    if (asset.status !== "airborne" && asset.status !== "fixed" && asset.status !== "lost-link") continue;
    const frame = airframe(asset.klass);
    for (const contact of w.contacts) {
      if (!contact.alive) continue;
      const d = dist(asset.pos, contact.pos);
      if (d > asset.sensor) continue;
      const hit = frame.sense(asset, contact, d);
      if (!hit) continue;
      if (take(w) > hit.p) continue;
      out.push({
        pos: {
          x: contact.pos.x + (take(w) - 0.5) * hit.sigma,
          y: contact.pos.y + (take(w) - 0.5) * hit.sigma,
        },
        klass: take(w) < 0.12 ? "unknown" : contact.klass,
        from: asset.id,
        sigma: hit.sigma,
      });
    }
  }
  return out;
}

function fuse(w: World, meas: Meas[]): void {
  const used = new Set<number>();
  for (const track of w.tracks) {
    track.pos.x += track.vel.x * w.dt;
    track.pos.y += track.vel.y * w.dt;
    track.cov += 36 * w.dt;
    let best = -1;
    let bestD = Infinity;
    meas.forEach((m, i) => {
      if (used.has(i)) return;
      const gate = 3 * Math.sqrt(track.cov) + m.sigma;
      const d = dist(track.pos, m.pos);
      if (d < gate && d < bestD) {
        best = i;
        bestD = d;
      }
    });
    if (best < 0) continue;
    used.add(best);
    const m = meas[best];
    const gain = track.cov / (track.cov + m.sigma * m.sigma);
    const ix = m.pos.x - track.pos.x;
    const iy = m.pos.y - track.pos.y;
    track.pos.x += gain * ix;
    track.pos.y += gain * iy;
    track.vel.x = track.vel.x * 0.65 + 0.35 * (ix / w.dt);
    track.vel.y = track.vel.y * 0.65 + 0.35 * (iy / w.dt);
    track.cov = Math.max(20, (1 - gain) * track.cov);
    track.confidence = clamp(track.confidence + 0.07, 0, 0.97);
    track.last = w.tick;
    if (!track.sensors.includes(m.from)) track.sensors.push(m.from);
    if (track.sensors.length > 4) track.sensors.shift();
    if (m.klass !== "unknown") track.klass = m.klass;
    if (!track.hostile && track.confidence >= 0.55 && track.klass !== "unknown") {
      track.hostile = true;
      note(w, "warn", `ARGUS ${track.id} hostile ${track.klass}. Sensors ${track.sensors.join(", ")}.`);
    }
  }
  meas.forEach((m, i) => {
    if (used.has(i)) return;
    if (w.tracks.some((t) => dist(t.pos, m.pos) < 90)) return;
    const track: Track = {
      id: `T-${w.nextTrack++}`,
      pos: { ...m.pos },
      vel: { x: 0, y: 0 },
      cov: m.sigma * m.sigma,
      klass: m.klass,
      confidence: 0.32,
      hostile: false,
      last: w.tick,
      sensors: [m.from],
    };
    w.tracks.push(track);
    note(w, "info", `ARGUS birthed ${track.id} from ${m.from} (${m.klass}).`);
  });
  w.tracks = w.tracks.filter((t) => w.tick - t.last < TRACK_COAST_S);
}

function draftEngagements(w: World): void {
  draftAzrail(w, (level, text) => note(w, level, text));
}

function resolveEngagements(w: World): void {
  resolveAzrail(w, (level, text) => note(w, level, text));
}

function drainAndRecover(w: World): void {
  for (const asset of w.assets) {
    if (asset.status === "docked") {
      const pad = w.assets.find((a) => a.klass === "FLOWER");
      const rate = pad ? airframe("FLOWER").recharge : 1 / 90;
      asset.battery = Math.min(1, asset.battery + w.dt * rate);
      continue;
    }
    if (asset.status === "fixed") continue;
    asset.battery = Math.max(0, asset.battery - w.dt / asset.endurance);
    if (asset.battery < 0.12 && asset.task?.kind !== "rtb") {
      asset.task = { kind: "rtb", waypoint: { ...asset.home } };
      note(w, "warn", `${asset.callsign} battery low. RTB.`);
    }
  }
}

function updateLinks(w: World): void {
  const relays = w.assets.filter((a) => airframe(a.klass).relayReach > 0 && a.status !== "docked");
  for (const asset of w.assets) {
    const frame = airframe(asset.klass);
    if (frame.fixedLink) {
      asset.link = 1;
      continue;
    }
    let best = frame.linkFloor;
    for (const relay of relays) {
      if (relay.id === asset.id) continue;
      const reach = airframe(relay.klass).relayReach;
      const q = Math.max(0, 1 - dist(asset.pos, relay.pos) / reach);
      if (q > best) best = q;
    }
    for (const jam of w.jams) {
      const d = Math.hypot(asset.pos.x - jam.x, asset.pos.y - jam.y);
      if (d < jam.r) best *= 1 - jam.strength * (1 - d / jam.r);
    }
    for (const other of w.assets) {
      const guard = airframe(other.klass);
      if (guard.protectRadius > 0 && dist(asset.pos, other.pos) < guard.protectRadius) {
        best = Math.max(best, guard.protectFloor);
      }
    }
    const prev = asset.link;
    asset.link = clamp(best, 0, 1);
    if (prev >= 0.3 && asset.link < 0.3 && asset.status === "airborne") {
      asset.status = "lost-link";
      note(w, "warn", `${asset.callsign} lost the mesh. Continuing last task.`);
    } else if (asset.status === "lost-link" && asset.link >= 0.38) {
      asset.status = "airborne";
      note(w, "info", `${asset.callsign} mesh restored.`);
    }
  }
}

function draftCoas(w: World): Coa[] {
  const weak = weakestLink(w);
  const slug = w.assets.find((a) => a.klass === "SLUG");
  const searchers = w.assets.filter(
    (a) => airframe(a.klass).layer === "Observe" && a.klass !== "EON" && a.status !== "docked" && a.status !== "fixed",
  );
  const pending = w.engagements.filter((e) => e.state === "pending").length;
  const holdTasks = searchers.slice(0, 4).map((a, i) => ({
    assetId: a.id,
    task: { kind: "search" as const, waypoint: cell(w, i + 1) },
  }));
  const relayTasks = slug && weak ? [{ assetId: slug.id, task: slugRelay(w, slug, weak) }] : [];
  return [
    {
      id: "shadow",
      title: "Shadow and report",
      summary: "Keep the sensors moving. Do not change ROE. No interceptor is committed.",
      tasks: holdTasks,
    },
    {
      id: "commit",
      title: "Review interceptor queue",
      summary:
        pending > 0
          ? `${pending} shot${pending === 1 ? "" : "s"} waiting. Adopting this does not approve them — use the queue.`
          : "No shot is waiting. AZRAIL stays on the cap.",
      tasks: [],
    },
    {
      id: "relay",
      title: "Shift the ground relay",
      summary: weak
        ? `Move SLUG toward ${weak.callsign}, the weakest link (${Math.round(weak.link * 100)}%).`
        : "No airborne link needs a relay.",
      tasks: relayTasks,
    },
  ];
}

function cell(w: World, index: number): Vec2 {
  const cols = 4;
  const col = index % cols;
  const row = Math.floor(index / cols) % 3;
  return {
    x: ((col + 0.5) / cols) * w.bounds.w,
    y: ((row + 0.5) / 3) * w.bounds.h,
  };
}

function note(w: World, level: SimEvent["level"], text: string): void {
  w.record = fnv1a(`${w.tick}|${level}|${text}`, w.record);
  w.events.push({ tick: w.tick, level, text, hash: w.record.toString(16).padStart(8, "0") });
}

function steer(body: { pos: Vec2; vel: Vec2 }, aim: Vec2, speed: number, dt: number): void {
  const dx = aim.x - body.pos.x;
  const dy = aim.y - body.pos.y;
  const d = Math.hypot(dx, dy) || 1;
  const step = Math.min(speed * dt, d);
  body.vel.x = (dx / d) * speed;
  body.vel.y = (dy / d) * speed;
  body.pos.x += (dx / d) * step;
  body.pos.y += (dy / d) * step;
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

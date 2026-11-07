import { take } from "../rng.ts";
import type { Asset, Contact, SimEvent, Track, Vec2, World } from "../types.ts";
import type { Airframe } from "./contract.ts";
import { dist, loiter } from "./contract.ts";

/** Counter-UAS. The only model that drafts and resolves a shot, and only after approval. */
export const azrail: Airframe = {
  klass: "AZRAIL",
  layer: "Act",
  role: "Counter-UAS",
  method:
    "Lead pursuit on an approved track, then a tabletop roll inside 320m. No seeker and no explosive. One pending shot per track, nearest AZRAIL only, inside 2.8km. HOLD blocks resolution. Stays on the cap when it recovers.",
  linkFloor: 0.08,
  relayReach: 0,
  fixedLink: false,
  protectRadius: 0,
  protectFloor: 0,
  recharge: 0,
  recover: "cap",
  launchable: false,
  brief: {
    proposition: "Intercept a hostile rotor inside the bubble after a person approves",
    stance: 0.05,
    reach: 0.4,
  },
  sense(asset, _contact, distance) {
    const span = Math.max(asset.sensor, 1);
    const p = 0.8 * (0.4 + 0.6 * asset.link) * (1 - 0.45 * (distance / span));
    const sigma = 8 + 40 * (distance / span);
    return { p, sigma };
  },
  aim(world, asset) {
    const task = asset.task;
    if (task?.kind === "intercept" && task.targetId) {
      const track = world.tracks.find((t) => t.id === task.targetId);
      if (!track) return asset.home;
      const lead = dist(asset.pos, track.pos) / Math.max(asset.speed, 1);
      return {
        x: track.pos.x + track.vel.x * lead * 0.5,
        y: track.pos.y + track.vel.y * lead * 0.5,
      };
    }
    if (!task || task.kind === "rtb") return task?.waypoint ?? asset.home;
    if (task.kind === "loiter") return loiter(world, asset, 80);
    return task.waypoint;
  },
  launchTask(asset) {
    return { kind: "loiter", waypoint: { ...asset.home } };
  },
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function closing(w: World, track: Track): boolean {
  const speed = Math.hypot(track.vel.x, track.vel.y);
  if (speed < 4) return false;
  for (const region of w.regions) {
    if (region.kind !== "base" && region.kind !== "objective") continue;
    const c = { x: region.x + region.w / 2, y: region.y + region.h / 2 };
    const dx = c.x - track.pos.x;
    const dy = c.y - track.pos.y;
    const mag = Math.hypot(dx, dy) || 1;
    const dot = (track.vel.x * dx + track.vel.y * dy) / (speed * mag);
    if (dot > 0.45 && mag < 5000) return true;
  }
  return false;
}

function nearestAlive(w: World, pos: Vec2, gate: number): Contact | undefined {
  let best: Contact | undefined;
  let bestD = gate;
  for (const contact of w.contacts) {
    if (!contact.alive) continue;
    const d = dist(contact.pos, pos);
    if (d < bestD) {
      best = contact;
      bestD = d;
    }
  }
  return best;
}

export function draftAzrail(
  w: World,
  note: (level: SimEvent["level"], text: string) => void,
): void {
  const shooters = w.assets.filter(
    (a) => a.klass === "AZRAIL" && a.engage > 0 && (a.status === "airborne" || a.status === "lost-link"),
  );
  for (const track of w.tracks) {
    if (!track.hostile) continue;
    const owned = w.engagements.some(
      (e) => e.trackId === track.id && (e.state === "pending" || e.state === "approved"),
    );
    if (owned) continue;
    let best: Asset | undefined;
    let bestD = 2800;
    for (const shooter of shooters) {
      if (shooter.task?.kind === "rtb" || shooter.battery < 0.15) continue;
      if (w.suppress.some((s) => s.key === `${shooter.id}:${track.id}`)) continue;
      const d = dist(shooter.pos, track.pos);
      const time = d / Math.max(shooter.speed, 1);
      if (time > shooter.battery * shooter.endurance) continue;
      if (d < bestD) {
        best = shooter;
        bestD = d;
      }
    }
    if (!best) continue;
    const inbound = closing(w, track);
    const pk = clamp(0.28 + 0.45 * (1 - bestD / 2800) * (0.5 + 0.5 * best.link), 0.2, 0.78);
    const engagement = {
      id: `E-${w.nextEng++}`,
      shooterId: best.id,
      trackId: track.id,
      state: "pending" as const,
      pk,
      reason: inbound ? `${track.klass} closing on a protected point` : `${track.klass} inside interceptor reach`,
    };
    w.engagements.push(engagement);
    note(
      "act",
      `${engagement.id} pending. ${best.callsign} → ${track.id}. Pk ${(pk * 100).toFixed(0)}%. Awaiting approval.`,
    );
  }
  if (w.engagements.length > 24) {
    const keep = w.engagements.filter((e) => e.state === "pending" || e.state === "approved");
    const rest = w.engagements.filter((e) => e.state !== "pending" && e.state !== "approved").slice(-8);
    w.engagements = [...rest, ...keep];
  }
}

export function resolveAzrail(
  w: World,
  note: (level: SimEvent["level"], text: string) => void,
): void {
  if (w.roe === "HOLD") return;
  for (const engagement of w.engagements) {
    if (engagement.state !== "approved") continue;
    const shooter = w.assets.find((a) => a.id === engagement.shooterId && a.klass === "AZRAIL");
    const track = w.tracks.find((t) => t.id === engagement.trackId);
    if (!shooter || !track || shooter.status === "docked") {
      engagement.state = "aborted";
      note("warn", `${engagement.id} aborted. Shooter or track unavailable.`);
      continue;
    }
    if (shooter.status === "lost-link" || shooter.link < 0.25 || dist(shooter.pos, track.pos) > shooter.engage) {
      continue;
    }
    const hit = take(w) < engagement.pk;
    engagement.state = "resolved";
    engagement.result = hit ? "stopped" : "miss";
    if (hit) {
      const contact = nearestAlive(w, track.pos, 180);
      if (contact) contact.alive = false;
      w.tracks = w.tracks.filter((t) => t.id !== track.id);
      shooter.task = { kind: "loiter", waypoint: { ...shooter.pos } };
    }
    note(
      "act",
      hit
        ? `${shooter.callsign} stopped ${track.id} inside ${shooter.engage}m (tabletop).`
        : `${shooter.callsign} missed ${track.id}. Track still live.`,
    );
  }
}

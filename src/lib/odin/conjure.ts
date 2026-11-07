import { fnv1a, nextRng } from "./rng.ts";
import type { Airframe } from "./models/contract.ts";
import { AIRFRAMES } from "./models/index.ts";
import type { AssetClass, Forecast, World } from "./types.ts";

/**
 * CONJURE for this tabletop.
 *
 * Procedural crowd only, from InfinitumCorp/zerkalo (`simulation._rule_decide`
 * and `network.build_graph`): bounded confidence, homophily, preferential
 * attachment. The language-model personas, the analyst write-up, and the
 * "design the outcome" compare loop are not ported.
 *
 * Agents are synthetic roles. A forecast is not a clearance.
 */

const SUPPORT = 0.2;
const OPPOSE = -0.2;
const AGENTS = 24;
const ROUNDS = 6;
const ACTIVE = 0.35;

const SEGMENTS = [
  { name: "Partner unit", share: 0.3, baseline: 0.35, susceptibility: 0.35 },
  { name: "Oversight", share: 0.2, baseline: -0.05, susceptibility: 0.22 },
  { name: "Affected community", share: 0.32, baseline: -0.28, susceptibility: 0.48 },
  { name: "Liaison", share: 0.18, baseline: 0.08, susceptibility: 0.3 },
];

interface Rng {
  next(): number;
}

interface Crowd {
  id: number;
  segment: number;
  stance: number;
  initial: number;
  certainty: number;
  susceptibility: number;
  activity: number;
  influence: number;
}

interface Post {
  id: number;
  round: number;
  author: number;
  stance: number;
  premise: boolean;
  likes: number;
  reposts: number;
  engagement: number;
}

function rngFrom(seed: number): Rng {
  let state = seed >>> 0 || 1;
  return {
    next() {
      const step = nextRng(state);
      state = step.state;
      return step.value;
    },
  };
}

function gauss(rng: Rng, mu: number, sigma: number): number {
  const u = Math.max(rng.next(), 1e-9);
  const v = rng.next();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
  return mu + z * sigma;
}

function clamp(n: number, lo = -1, hi = 1): number {
  return Math.max(lo, Math.min(hi, n));
}

function allocate(total: number, shares: number[]): number[] {
  const raw = shares.map((s) => s * total);
  const counts = raw.map((x) => Math.floor(x));
  let left = total - counts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((x, i) => ({ i, frac: x - counts[i] }))
    .sort((a, b) => b.frac - a.frac);
  for (const row of order) {
    if (left <= 0) break;
    counts[row.i] += 1;
    left -= 1;
  }
  return counts;
}

function buildCrowd(rng: Rng): Crowd[] {
  const counts = allocate(
    AGENTS,
    SEGMENTS.map((s) => s.share),
  );
  const agents: Crowd[] = [];
  counts.forEach((n, segment) => {
    const spec = SEGMENTS[segment];
    for (let i = 0; i < n; i++) {
      const stance = clamp(gauss(rng, spec.baseline, 0.35));
      agents.push({
        id: agents.length,
        segment,
        stance,
        initial: stance,
        certainty: 0.15 + rng.next() * 0.75,
        susceptibility: spec.susceptibility,
        activity: 0.15 + rng.next() * 0.65,
        influence: 0,
      });
    }
  });
  return agents;
}

function buildGraph(agents: Crowd[], rng: Rng): number[][] {
  const bySeg: number[][] = SEGMENTS.map(() => []);
  for (const agent of agents) bySeg[agent.segment].push(agent.id);
  const indeg = agents.map(() => 1);
  const follows: number[][] = agents.map(() => []);
  const order = agents.map((a) => a.id);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }
  for (const id of order) {
    const agent = agents[id];
    const k = Math.max(2, Math.round(gauss(rng, 4, 1.2)));
    const targets = new Set<number>();
    let tries = 0;
    while (targets.size < k && tries < k * 12) {
      tries += 1;
      const pool = rng.next() < 0.75 ? bySeg[agent.segment] : agents.map((a) => a.id);
      const sample: number[] = [];
      for (let n = 0; n < Math.min(3, pool.length); n++) {
        sample.push(pool[Math.floor(rng.next() * pool.length)]);
      }
      let best = sample[0];
      let bestW = -1;
      for (const cand of sample) {
        const w = indeg[cand] * rng.next();
        if (w > bestW) {
          bestW = w;
          best = cand;
        }
      }
      if (best !== id) targets.add(best);
    }
    for (const target of targets) {
      follows[id].push(target);
      indeg[target] += 1;
    }
  }
  const top = Math.max(...indeg);
  for (const agent of agents) {
    agent.influence = (indeg[agent.id] - 1) / Math.max(top - 1, 1);
  }
  return follows;
}

function feedMean(feed: Post[]): number {
  if (feed.length === 0) return 0;
  let acc = 0;
  let w = 0;
  for (const post of feed) {
    const weight = 1 + (post.premise ? 2 : 0) + 0.1 * post.engagement;
    acc += post.stance * weight;
    w += weight;
  }
  return acc / w;
}

function rehearseFrame(world: World, frame: Airframe): Forecast {
  const pending = world.engagements.some(
    (e) => e.state === "pending" && world.assets.find((a) => a.id === e.shooterId)?.klass === frame.klass,
  );
  const stance = clamp(frame.brief.stance - (pending ? 0.25 : 0));
  const reach = frame.brief.reach;
  const rng = rngFrom((world.seed ^ fnv1a(frame.klass) ^ (pending ? 0x51 : 0)) >>> 0);
  const agents = buildCrowd(rng);
  const follows = buildGraph(agents, rng);
  const nReach = Math.round(reach * agents.length);
  const ranked = [...agents].sort((a, b) => b.influence - a.influence);
  const followers = new Set<number>();
  for (const agent of ranked.slice(0, Math.floor(nReach / 2))) followers.add(agent.id);
  const rest = ranked.slice(Math.floor(nReach / 2)).map((a) => a.id);
  while (followers.size < nReach && rest.length > 0) {
    const i = Math.floor(rng.next() * rest.length);
    followers.add(rest.splice(i, 1)[0]);
  }

  const posts: Post[] = [];
  const exposed = new Set<number>();

  for (let round = 1; round <= ROUNDS; round++) {
    if (round === 2) {
      posts.push({
        id: posts.length,
        round,
        author: -1,
        stance,
        premise: true,
        likes: 0,
        reposts: 0,
        engagement: 0,
      });
    }
    for (const agent of agents) {
      if (rng.next() >= ACTIVE * agent.activity) continue;
      const recent = posts.filter((p) => p.round >= round - 3 && p.author !== agent.id);
      const seen = follows[agent.id];
      const mine = recent.filter(
        (p) => seen.includes(p.author) || (p.author === -1 && followers.has(agent.id)),
      );
      const feed = mine.slice(-4);
      if (feed.some((p) => p.premise)) exposed.add(agent.id);
      const mean = feedMean(feed);
      let next = agent.stance;
      if (feed.length > 0) {
        const delta = mean - next;
        const eps = 0.45 + 0.9 * (1 - agent.certainty);
        if (Math.abs(delta) < eps) {
          next += 0.3 * agent.susceptibility * (1 - 0.5 * agent.certainty) * delta;
        } else {
          next -= 0.04 * agent.certainty * (delta > 0 ? 1 : -1);
        }
      }
      next = clamp(next + gauss(rng, 0, 0.01));
      const aligned = feed.filter((p) => Math.abs(p.stance - next) < 0.35);
      const roll = rng.next();
      if (aligned.length > 0 && roll < 0.35) {
        const post = aligned[Math.floor(rng.next() * aligned.length)];
        post.likes += 1;
        post.engagement = post.likes + 2 * post.reposts;
      } else if (aligned.length > 0 && roll < 0.35 + 0.12 * (1 + agent.influence)) {
        const post = aligned.reduce((best, p) => (p.engagement > best.engagement ? p : best));
        post.reposts += 1;
        post.engagement = post.likes + 2 * post.reposts;
        posts.push({
          id: posts.length,
          round,
          author: agent.id,
          stance: post.stance,
          premise: post.premise,
          likes: 0,
          reposts: 0,
          engagement: 0,
        });
        if (post.premise) exposed.add(agent.id);
      }
      agent.stance = next;
    }
  }

  const support = agents.filter((a) => a.stance > SUPPORT).length / agents.length;
  const oppose = agents.filter((a) => a.stance < OPPOSE).length / agents.length;
  const means = SEGMENTS.map((_, i) => {
    const group = agents.filter((a) => a.segment === i);
    const avg = group.reduce((s, a) => s + a.stance, 0) / group.length;
    return { name: SEGMENTS[i].name, avg };
  });
  const resistant = means.filter((m) => m.avg < OPPOSE).map((m) => m.name);
  const exposure = exposed.size / agents.length;
  const mean = agents.reduce((s, a) => s + a.stance, 0) / agents.length;
  const variance = agents.reduce((s, a) => s + (a.stance - mean) ** 2, 0) / agents.length;
  const polarization = Math.sqrt(variance);
  const confidence: Forecast["confidence"] =
    exposure < 0.25 ? "low" : exposure > 0.45 && polarization < 0.4 ? "high" : "medium";
  const resistantText = resistant.length > 0 ? resistant.join(", ") : "none";
  const adjustment =
    oppose > support
      ? `Do not treat this as clearance. Brief ${resistantText} before the action.`
      : "The synthetic room does not block it. A person still approves every shot.";

  return {
    klass: frame.klass,
    proposition: frame.brief.proposition,
    support: round4(support),
    oppose: round4(oppose),
    exposure: round4(exposure),
    resistant: resistantText,
    adjustment,
    confidence,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function attachForecasts(world: World): void {
  const forecasts: Forecast[] = [];
  for (const frame of Object.values(AIRFRAMES)) forecasts.push(rehearseFrame(world, frame));
  world.forecasts = forecasts;
}

export function forecastFor(world: World, klass: AssetClass): Forecast | undefined {
  return world.forecasts.find((f) => f.klass === klass);
}

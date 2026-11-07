import { attachForecasts } from "./conjure.ts";
import { fnv1a } from "./rng.ts";
import type {
  Asset,
  AssetClass,
  Contact,
  ScenarioId,
  Task,
  TrackClass,
  Vec2,
  World,
} from "./types.ts";

interface Spec {
  endurance: number;
  speed: number;
  sensor: number;
  engage: number;
  alt: number;
}

const SPECS: Record<AssetClass, Spec> = {
  CHERUBIM: { endurance: 18 * 60, speed: 16, sensor: 700, engage: 0, alt: 40 },
  SERAPHIM: { endurance: 10 * 3600, speed: 32, sensor: 3600, engage: 0, alt: 420 },
  AZRAIL: { endurance: 40 * 60, speed: 48, sensor: 900, engage: 320, alt: 90 },
  POLLEN: { endurance: 25 * 60, speed: 12, sensor: 450, engage: 0, alt: 30 },
  FLOWER: { endurance: 1e9, speed: 0, sensor: 200, engage: 0, alt: 0 },
  SLUG: { endurance: 4 * 3600, speed: 5, sensor: 80, engage: 0, alt: 0 },
  ORBIS: { endurance: 20 * 60, speed: 3, sensor: 180, engage: 0, alt: 2 },
  EON: { endurance: 1e9, speed: 0, sensor: 1400, engage: 0, alt: 1 },
};

function task(kind: Task["kind"], waypoint: Vec2, queue?: Vec2[]): Task {
  return queue ? { kind, waypoint, queue } : { kind, waypoint };
}

function asset(
  id: string,
  callsign: string,
  klass: AssetClass,
  pos: Vec2,
  status: Asset["status"],
  mission: Task | null,
): Asset {
  const spec = SPECS[klass];
  return {
    id,
    callsign,
    klass,
    pos: { ...pos },
    vel: { x: 0, y: 0 },
    heading: 0,
    alt: spec.alt,
    battery: status === "docked" ? 1 : 0.9,
    endurance: spec.endurance,
    speed: spec.speed,
    sensor: spec.sensor,
    engage: spec.engage,
    link: 1,
    task: mission,
    status,
    home: { ...pos },
  };
}

function contact(
  id: string,
  klass: Exclude<TrackClass, "unknown">,
  speed: number,
  route: Vec2[],
): Contact {
  return {
    id,
    pos: { ...route[0] },
    vel: { x: 0, y: 0 },
    speed,
    klass,
    alive: true,
    route,
    routeI: 1,
    flagged: false,
  };
}

function shell(
  scenario: ScenarioId,
  title: string,
  seed: number,
  bounds: { w: number; h: number },
): World {
  return {
    scenario,
    title,
    seed,
    rng: seed >>> 0 || 1,
    tick: 0,
    dt: 1,
    roe: "HOLD",
    bounds,
    assets: [],
    contacts: [],
    tracks: [],
    engagements: [],
    events: [],
    coas: [],
    forecasts: [],
    regions: [],
    jams: [],
    nextTrack: 1,
    nextEng: 1,
    record: fnv1a(`${scenario}:${seed}`),
    suppress: [],
  };
}

export function makeScenario(id: ScenarioId, seed: number): World {
  const world = id === "harbor" ? harbor(seed) : id === "gallery" ? gallery(seed) : hearth(seed);
  attachForecasts(world);
  return world;
}

function hearth(seed: number): World {
  const w = shell("hearth", "Hearth Depot", seed, { w: 6400, h: 4800 });
  const flower = { x: 780, y: 760 };
  w.regions = [
    { name: "FLOWER-1", x: 620, y: 600, w: 360, h: 320, kind: "base" },
    { name: "PIER", x: 4840, y: 3360, w: 420, h: 360, kind: "objective" },
  ];
  w.jams = [{ x: 3600, y: 2300, r: 820, strength: 0.72 }];
  const search = (wp: Vec2, queue: Vec2[]): Task => task("search", wp, queue);
  w.assets = [
    asset("FL-1", "FLOWER-1", "FLOWER", flower, "fixed", null),
    asset("EO-1", "EON-1", "EON", { x: 980, y: 980 }, "fixed", null),
    asset("CH-1", "CHERUB-1", "CHERUBIM", { x: 1500, y: 1280 }, "airborne", task("loiter", { x: 1600, y: 1400 })),
    asset("CH-2", "CHERUB-2", "CHERUBIM", { x: 1960, y: 860 }, "airborne", task("loiter", { x: 2000, y: 1000 })),
    asset(
      "SE-1",
      "SERAPH-1",
      "SERAPHIM",
      { x: 2400, y: 2200 },
      "airborne",
      search({ x: 4200, y: 1800 }, [
        { x: 5200, y: 3000 },
        { x: 3000, y: 3600 },
        { x: 2200, y: 2400 },
      ]),
    ),
    asset("AZ-1", "AZRAIL-1", "AZRAIL", { x: 1100, y: 1180 }, "airborne", task("loiter", { x: 1200, y: 1300 })),
    asset("AZ-2", "AZRAIL-2", "AZRAIL", { x: 1480, y: 700 }, "airborne", task("loiter", { x: 1500, y: 860 })),
    asset("PO-1", "POLLEN-1", "POLLEN", { x: 2100, y: 1600 }, "airborne", task("search", { x: 2800, y: 2000 })),
    asset("PO-2", "POLLEN-2", "POLLEN", { x: 2500, y: 1100 }, "airborne", task("search", { x: 3200, y: 1400 })),
    asset("PO-3", "POLLEN-3", "POLLEN", flower, "docked", null),
    asset("PO-4", "POLLEN-4", "POLLEN", flower, "docked", null),
    asset("PO-5", "POLLEN-5", "POLLEN", flower, "docked", null),
    asset("PO-6", "POLLEN-6", "POLLEN", flower, "docked", null),
    asset("SL-1", "SLUG-1", "SLUG", { x: 1080, y: 1500 }, "airborne", task("loiter", { x: 1200, y: 1500 })),
    asset("OR-1", "ORBIS-1", "ORBIS", { x: 1680, y: 1680 }, "airborne", task("inspect", { x: 1700, y: 1700 })),
  ];
  w.contacts = [
    contact("C-1", "wing", 28, [
      { x: 6200, y: 4500 },
      { x: 5000, y: 3540 },
      { x: 1800, y: 1100 },
    ]),
    contact("C-2", "swarm", 16, [
      { x: 4300, y: 4600 },
      { x: 2400, y: 2200 },
      { x: 900, y: 900 },
    ]),
    contact("C-3", "swarm", 16, [
      { x: 4700, y: 4400 },
      { x: 2600, y: 2000 },
      { x: 1000, y: 800 },
    ]),
    contact("C-4", "rotor", 14, [
      { x: 5600, y: 1800 },
      { x: 3600, y: 1600 },
      { x: 1400, y: 900 },
    ]),
  ];
  noteBoot(w);
  return w;
}

function harbor(seed: number): World {
  const w = shell("harbor", "Harbor Patrol", seed, { w: 6400, h: 4800 });
  const flower = { x: 860, y: 2400 };
  w.regions = [
    { name: "ROADS", x: 2800, y: 0, w: 3600, h: 4800, kind: "water" },
    { name: "FLOWER-1", x: 680, y: 2140, w: 380, h: 360, kind: "base" },
    { name: "CHANNEL", x: 5000, y: 2200, w: 460, h: 400, kind: "objective" },
  ];
  w.jams = [{ x: 4600, y: 2600, r: 700, strength: 0.6 }];
  w.assets = [
    asset("FL-1", "FLOWER-1", "FLOWER", flower, "fixed", null),
    asset("EO-1", "EON-1", "EON", { x: 1100, y: 2500 }, "fixed", null),
    asset(
      "SE-1",
      "SERAPH-1",
      "SERAPHIM",
      { x: 3000, y: 2400 },
      "airborne",
      task("search", { x: 4200, y: 1600 }, [
        { x: 5400, y: 2400 },
        { x: 4200, y: 3400 },
        { x: 3000, y: 2400 },
      ]),
    ),
    asset("CH-1", "CHERUB-1", "CHERUBIM", { x: 1400, y: 2000 }, "airborne", task("loiter", { x: 1500, y: 2100 })),
    asset("AZ-1", "AZRAIL-1", "AZRAIL", { x: 1200, y: 2700 }, "airborne", task("loiter", { x: 1400, y: 2800 })),
    asset("AZ-2", "AZRAIL-2", "AZRAIL", { x: 1500, y: 2200 }, "airborne", task("loiter", { x: 1600, y: 2400 })),
    asset("PO-1", "POLLEN-1", "POLLEN", { x: 2200, y: 1800 }, "airborne", task("search", { x: 2600, y: 1400 })),
    asset("PO-2", "POLLEN-2", "POLLEN", { x: 2200, y: 3000 }, "airborne", task("search", { x: 2600, y: 3400 })),
    asset("PO-3", "POLLEN-3", "POLLEN", flower, "docked", null),
    asset("SL-1", "SLUG-1", "SLUG", { x: 1300, y: 3000 }, "airborne", task("relay", { x: 2000, y: 2800 })),
    asset("OR-1", "ORBIS-1", "ORBIS", { x: 1000, y: 2100 }, "docked", null),
  ];
  w.contacts = [
    contact("C-1", "wing", 30, [
      { x: 6200, y: 800 },
      { x: 5200, y: 2400 },
      { x: 1600, y: 2500 },
    ]),
    contact("C-2", "rotor", 18, [
      { x: 6000, y: 4000 },
      { x: 4800, y: 2800 },
      { x: 1400, y: 2400 },
    ]),
  ];
  noteBoot(w);
  return w;
}

function gallery(seed: number): World {
  const w = shell("gallery", "Gallery Block", seed, { w: 4200, h: 3200 });
  const flower = { x: 520, y: 480 };
  w.regions = [
    { name: "BLOCK", x: 1600, y: 900, w: 1500, h: 1200, kind: "urban" },
    { name: "FLOWER-1", x: 360, y: 320, w: 340, h: 300, kind: "base" },
    { name: "COURT", x: 2000, y: 1200, w: 360, h: 320, kind: "objective" },
  ];
  w.jams = [{ x: 2300, y: 1500, r: 420, strength: 0.55 }];
  w.assets = [
    asset("FL-1", "FLOWER-1", "FLOWER", flower, "fixed", null),
    asset("EO-1", "EON-1", "EON", { x: 700, y: 700 }, "fixed", null),
    asset("CH-1", "CHERUB-1", "CHERUBIM", { x: 1400, y: 1100 }, "airborne", task("loiter", { x: 1500, y: 1200 })),
    asset("CH-2", "CHERUB-3", "CHERUBIM", { x: 2100, y: 1500 }, "airborne", task("inspect", { x: 2200, y: 1500 })),
    asset("OR-1", "ORBIS-1", "ORBIS", { x: 2300, y: 1400 }, "airborne", task("inspect", { x: 2400, y: 1450 })),
    asset("AZ-1", "AZRAIL-1", "AZRAIL", { x: 800, y: 900 }, "airborne", task("loiter", { x: 900, y: 1000 })),
    asset("SE-1", "SERAPH-1", "SERAPHIM", { x: 1100, y: 2200 }, "airborne", task("search", { x: 2800, y: 600 })),
    asset("PO-1", "POLLEN-1", "POLLEN", flower, "docked", null),
    asset("PO-2", "POLLEN-2", "POLLEN", flower, "docked", null),
    asset("SL-1", "SLUG-1", "SLUG", { x: 640, y: 860 }, "airborne", task("loiter", { x: 700, y: 900 })),
  ];
  w.contacts = [
    contact("C-1", "rotor", 8, [
      { x: 2800, y: 1800 },
      { x: 2100, y: 1400 },
      { x: 700, y: 600 },
    ]),
    contact("C-2", "swarm", 12, [
      { x: 3900, y: 2800 },
      { x: 2400, y: 1600 },
      { x: 600, y: 500 },
    ]),
  ];
  noteBoot(w);
  return w;
}

function noteBoot(w: World): void {
  const text = `${w.title} loaded. Weapons HOLD. Tracks are kinematic classes only.`;
  w.record = fnv1a(`${w.tick}|${text}`, w.record);
  w.events.push({ tick: 0, level: "info", text, hash: w.record.toString(16) });
}

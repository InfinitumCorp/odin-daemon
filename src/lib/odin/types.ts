/** Plain data only. The sim never leaves this shape, so it can cross the server boundary. */

export type ScenarioId = "hearth" | "harbor" | "gallery";

export type AssetClass =
  | "CHERUBIM"
  | "SERAPHIM"
  | "AZRAIL"
  | "POLLEN"
  | "FLOWER"
  | "SLUG"
  | "ORBIS"
  | "EON";

export type AssetStatus = "airborne" | "docked" | "lost-link" | "fixed";

export type TrackClass = "rotor" | "wing" | "swarm" | "unknown";

export type Roe = "HOLD" | "TIGHT";

export type Role = "observer" | "analyst" | "commander";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Task {
  kind: "loiter" | "search" | "intercept" | "relay" | "rtb" | "inspect";
  /** Track id for an intercept. Never a person. */
  targetId?: string;
  waypoint: Vec2;
  queue?: Vec2[];
}

export interface Asset {
  id: string;
  callsign: string;
  klass: AssetClass;
  pos: Vec2;
  vel: Vec2;
  heading: number;
  alt: number;
  battery: number;
  endurance: number;
  speed: number;
  sensor: number;
  /** Tabletop bubble in meters. Zero means this airframe cannot be tasked to intercept. */
  engage: number;
  link: number;
  task: Task | null;
  status: AssetStatus;
  home: Vec2;
}

export interface Contact {
  id: string;
  pos: Vec2;
  vel: Vec2;
  speed: number;
  klass: Exclude<TrackClass, "unknown">;
  alive: boolean;
  route: Vec2[];
  routeI: number;
  flagged: boolean;
}

export interface Track {
  id: string;
  pos: Vec2;
  vel: Vec2;
  /** Scalar position variance, meters squared. */
  cov: number;
  klass: TrackClass;
  confidence: number;
  hostile: boolean;
  last: number;
  sensors: string[];
}

export interface Engagement {
  id: string;
  shooterId: string;
  trackId: string;
  state: "pending" | "approved" | "denied" | "resolved" | "aborted";
  /** Abstract tabletop probability. Not a seeker model. */
  pk: number;
  reason: string;
  result?: "stopped" | "miss";
}

export interface SimEvent {
  tick: number;
  level: "info" | "warn" | "act";
  text: string;
  hash: string;
}

export interface Forecast {
  klass: AssetClass;
  proposition: string;
  support: number;
  oppose: number;
  exposure: number;
  resistant: string;
  adjustment: string;
  confidence: "low" | "medium" | "high";
}

export interface Coa {
  id: string;
  title: string;
  summary: string;
  tasks: { assetId: string; task: Task }[];
}

export interface Region {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "water" | "urban" | "objective" | "base";
}

export interface JamZone {
  x: number;
  y: number;
  r: number;
  /** 0–1 attenuation inside the circle. Not a waveform. */
  strength: number;
}

export interface World {
  scenario: ScenarioId;
  title: string;
  seed: number;
  rng: number;
  tick: number;
  dt: number;
  roe: Roe;
  bounds: { w: number; h: number };
  assets: Asset[];
  contacts: Contact[];
  tracks: Track[];
  engagements: Engagement[];
  events: SimEvent[];
  coas: Coa[];
  /** One CONJURE rehearsal per airframe. Advisory. Not a clearance. */
  forecasts: Forecast[];
  regions: Region[];
  jams: JamZone[];
  nextTrack: number;
  nextEng: number;
  /** FNV-1a chain over the flight record. A hash, not a ledger network. */
  record: number;
  suppress: { key: string; until: number }[];
}

export type Command =
  | { type: "approve"; engagementId: string }
  | { type: "deny"; engagementId: string }
  | { type: "roe"; roe: Roe }
  | { type: "launch"; assetId: string }
  | { type: "adopt"; coaId: string };

export interface Trace {
  fn: string;
  ms: number;
  bytesIn: number;
  bytesOut: number;
}

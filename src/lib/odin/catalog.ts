import { AIRFRAMES } from "./models/index.ts";

/** What this backend actually is. Public methods, original code. */

export interface ModuleNote {
  id: string;
  layer: "Observe" | "Orient" | "Decide" | "Act" | "Record";
  role: string;
  method: string;
}

export const PROVENANCE =
  "Original tabletop engine for the ODIN° DAEMON series. Each airframe has its own backend. CONJURE is a procedural crowd: bounded confidence and a homophilous graph, no language model, synthetic roles only. A forecast does not clear a shot. No repository from Anduril, Meta, Tesla, Apple, Palantir, SpaceX, a satellite operator, a Five Eyes agency, DJI, Microsoft, AWS, NVIDIA, Flock, or a biometrics vendor was cloned. Facial recognition is not part of this build.";

const SUITE: ModuleNote[] = [
  {
    id: "ARGUS",
    layer: "Observe",
    role: "Fuse drone measurements into tracks",
    method:
      "Gated nearest-neighbor association and a constant-velocity Kalman update (Kalman, 1960). Scalar variance, not a production tracker. Each airframe supplies its own detection probability and noise.",
  },
  {
    id: "AETHER",
    layer: "Act",
    role: "Mesh quality",
    method:
      "Reads each model's link floor and relay reach. Jam circles attenuate. Lost-link aircraft keep their last task.",
  },
  {
    id: "CONJURE",
    layer: "Decide",
    role: "Rehearse who objects before the action",
    method:
      "Procedural path. Twenty-four synthetic roles, six rounds, bounded confidence. Each airframe seeds its own plan. The report is advisory and never approves an engagement.",
  },
  {
    id: "SCALVS",
    layer: "Decide",
    role: "Course-of-action drafts",
    method: "Three rule-written options. Nothing is flown until a person adopts one.",
  },
  {
    id: "ARCHITECT",
    layer: "Decide",
    role: "Turn an adopted plan into tasks",
    method:
      "Writes loiter, search, and relay tasks onto airframes. Intercepts stay inside the AZRAIL backend.",
  },
  {
    id: "Firmament record",
    layer: "Record",
    role: "Flight-record hash chain",
    method: "FNV-1a over each event. A tamper-evident log for the sim, not a permissioned chain network.",
  },
  {
    id: "ei·det·ic",
    layer: "Orient",
    role: "Not in this build",
    method:
      "No biometrics, no face embeddings, no identity matching. Tracks are kinematic classes only: rotor, wing, swarm, unknown.",
  },
];

export const MODULES: ModuleNote[] = [
  ...Object.values(AIRFRAMES).map((frame) => ({
    id: frame.klass,
    layer: frame.layer,
    role: frame.role,
    method: frame.method,
  })),
  ...SUITE,
];
import type { Airframe } from "./contract.ts";

/** Worn spectrum post. Coarse detection and a link floor for friendlies nearby. No jammer. */
export const eon: Airframe = {
  klass: "EON",
  layer: "Observe",
  role: "Spectrum post",
  method:
    "Fixed. Detection is a coarse range, not a camera. Friendlies inside 420m keep at least half a link. It does not emit a jamming waveform and it does not shoot.",
  linkFloor: 1,
  relayReach: 900,
  fixedLink: true,
  protectRadius: 420,
  protectFloor: 0.5,
  recharge: 0,
  recover: "cap",
  launchable: false,
  brief: {
    proposition: "Warn on a hostile control link and hand the track to AZRAIL",
    stance: 0.1,
    reach: 0.4,
  },
  sense(asset, _contact, distance) {
    const span = Math.max(asset.sensor, 1);
    const p = 0.66 * (0.5 + 0.5 * asset.link) * (1 - 0.25 * (distance / span));
    const sigma = 30 + 90 * (distance / span);
    return { p, sigma };
  },
  aim(_world, asset) {
    return asset.pos;
  },
  launchTask(asset) {
    return { kind: "loiter", waypoint: { ...asset.pos } };
  },
};

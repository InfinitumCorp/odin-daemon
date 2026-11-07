import type { Airframe } from "./contract.ts";

/** Pad. Fixed relay, launches POLLEN / CHERUBIM / ORBIS, recharges whatever is docked. */
export const flower: Airframe = {
  klass: "FLOWER",
  layer: "Act",
  role: "Launch and recharge",
  method:
    "Does not fly. Fixed mesh node with a 2.6km reach and a short pad sensor. Docked aircraft regain about one percent of battery every 0.7s of sim time. Launch is refused for models that are not launchable.",
  linkFloor: 1,
  relayReach: 2600,
  fixedLink: true,
  protectRadius: 0,
  protectFloor: 0,
  recharge: 1 / 70,
  recover: "dock",
  launchable: false,
  brief: {
    proposition: "Open the dock, launch the waiting aircraft, and recover them",
    stance: 0.7,
    reach: 0.1,
  },
  sense(asset, _contact, distance) {
    const span = Math.max(asset.sensor, 1);
    const p = 0.45 * (1 - 0.5 * (distance / span));
    const sigma = 20 + 60 * (distance / span);
    return { p, sigma };
  },
  aim(_world, asset) {
    return asset.pos;
  },
  launchTask(asset) {
    return { kind: "loiter", waypoint: { ...asset.home } };
  },
};

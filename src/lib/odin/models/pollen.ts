import type { Airframe } from "./contract.ts";
import { loiter } from "./contract.ts";

/** Small ISR. Launched from FLOWER, searches a cell, docks when the pack is spent. */
export const pollen: Airframe = {
  klass: "POLLEN",
  layer: "Observe",
  role: "Swarm ISR",
  method:
    "Short sensor, slightly lower detection than CHERUBIM, launched from FLOWER onto a search cell. No weapon. Docks and takes a charge from the pad.",
  linkFloor: 0.08,
  relayReach: 0,
  fixedLink: false,
  protectRadius: 0,
  protectFloor: 0,
  recharge: 0,
  recover: "dock",
  launchable: true,
  brief: {
    proposition: "Spread a micro-aircraft swarm for coverage of the cell",
    stance: 0.25,
    reach: 0.28,
  },
  sense(asset, _contact, distance) {
    const span = Math.max(asset.sensor, 1);
    const p = 0.72 * (0.35 + 0.65 * asset.link) * (1 - 0.5 * (distance / span));
    const sigma = 10 + 48 * (distance / span);
    return { p, sigma };
  },
  aim(world, asset) {
    const task = asset.task;
    if (!task || task.kind === "rtb") return task?.waypoint ?? asset.home;
    if (task.kind === "search" || task.kind === "relay") return task.waypoint;
    return loiter(world, asset, 36);
  },
  launchTask(_asset, cell) {
    return { kind: "search", waypoint: cell };
  },
};

import type { Airframe } from "./contract.ts";
import { loiter } from "./contract.ts";

/** Long-endurance search. Coarse wide sensor, mesh relay, stays airborne at the cap. */
export const seraphim: Airframe = {
  klass: "SERAPHIM",
  layer: "Observe",
  role: "Endurance search and relay",
  method:
    "Wide sensor with coarser noise. Follows a search racetrack. Link floor 0.42 and a 5.2km relay reach so the rest of the flight can see past the pad. Unarmed. Recovers to a cap, not a dock.",
  linkFloor: 0.42,
  relayReach: 5200,
  fixedLink: false,
  protectRadius: 0,
  protectFloor: 0,
  recharge: 0,
  recover: "cap",
  launchable: false,
  brief: {
    proposition: "Hold a long patrol and relay past the unit horizon",
    stance: 0.55,
    reach: 0.12,
  },
  sense(asset, _contact, distance) {
    const span = Math.max(asset.sensor, 1);
    const p = 0.92 * (0.45 + 0.55 * asset.link) * (1 - 0.35 * (distance / span));
    const sigma = 14 + 70 * (distance / span);
    return { p, sigma };
  },
  aim(world, asset) {
    const task = asset.task;
    if (!task || task.kind === "rtb") return task?.waypoint ?? asset.home;
    if (task.kind === "search" || task.kind === "relay") return task.waypoint;
    return loiter(world, asset, 160);
  },
  launchTask(_asset, cell) {
    return { kind: "search", waypoint: cell };
  },
};

import type { Airframe } from "./contract.ts";
import { dist, loiter } from "./contract.ts";

/** Confined-space scout. Hard cutoff past half its short sensor. Unarmed. */
export const orbis: Airframe = {
  klass: "ORBIS",
  layer: "Observe",
  role: "Confined-space scout",
  method:
    "Refuses a measurement past 55% of its short sensor. Inside that ball the noise is tight. Inspect loiter is 22m. No engagement bubble. Can launch from FLOWER into the nearest urban block.",
  linkFloor: 0.08,
  relayReach: 0,
  fixedLink: false,
  protectRadius: 0,
  protectFloor: 0,
  recharge: 0,
  recover: "dock",
  launchable: true,
  brief: {
    proposition: "Send a confined-space aircraft ahead of the team",
    stance: 0.2,
    reach: 0.22,
  },
  sense(asset, _contact, distance) {
    if (distance > asset.sensor * 0.55) return null;
    const span = Math.max(asset.sensor, 1);
    const p = 0.95 * (0.6 + 0.4 * asset.link) * (1 - 0.2 * (distance / span));
    const sigma = 3 + 12 * (distance / span);
    return { p, sigma };
  },
  aim(world, asset) {
    const task = asset.task;
    if (!task || task.kind === "rtb") return task?.waypoint ?? asset.home;
    if (task.kind === "search" || task.kind === "relay") return task.waypoint;
    const urban = world.regions.find((r) => r.kind === "urban");
    if (task.kind === "inspect" && urban && dist(asset.pos, { x: urban.x, y: urban.y }) > 2000) {
      return { x: urban.x + urban.w / 2, y: urban.y + urban.h / 2 };
    }
    return loiter(world, asset, 22);
  },
  launchTask(asset) {
    return { kind: "inspect", waypoint: { x: asset.home.x + 60, y: asset.home.y + 40 } };
  },
};

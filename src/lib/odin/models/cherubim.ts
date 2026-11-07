import type { Airframe } from "./contract.ts";
import { dist, loiter } from "./contract.ts";

/** Close-quarters overwatch. Shadows a nearby hostile track. Does not shoot. */
export const cherubim: Airframe = {
  klass: "CHERUBIM",
  layer: "Observe",
  role: "Close overwatch",
  method:
    "Short sensor with tighter noise inside 280m. If a hostile track is inside the bubble it shadows that track; otherwise it loiters. Unarmed. Docks to recharge.",
  linkFloor: 0.08,
  relayReach: 0,
  fixedLink: false,
  protectRadius: 0,
  protectFloor: 0,
  recharge: 0,
  recover: "dock",
  launchable: true,
  brief: {
    proposition: "Put a close-quarters overwatch aircraft over the urban cell",
    stance: 0.35,
    reach: 0.22,
  },
  sense(asset, _contact, distance) {
    const near = distance < 280;
    const fall = near ? 0.12 : 0.62;
    const p = 0.9 * (0.5 + 0.5 * asset.link) * (1 - fall * (distance / Math.max(asset.sensor, 1)));
    const sigma = (near ? 4 : 16) + 28 * (distance / Math.max(asset.sensor, 1));
    return { p, sigma };
  },
  aim(world, asset) {
    const task = asset.task;
    if (!task || task.kind === "rtb") return task?.waypoint ?? asset.home;
    if (task.kind === "search") return task.waypoint;
    const track = world.tracks.find((t) => t.hostile && dist(asset.pos, t.pos) < asset.sensor);
    if (track) return { x: track.pos.x + 90, y: track.pos.y - 40 };
    return loiter(world, asset, 45);
  },
  launchTask(asset) {
    return { kind: "loiter", waypoint: { x: asset.home.x + 180, y: asset.home.y + 120 } };
  },
};

import type { Asset, Task, World } from "../types.ts";
import type { Airframe } from "./contract.ts";
import { dist } from "./contract.ts";

/** Ground relay. Drives toward the weakest airborne link. No weapon and no casualty model. */
export const slug: Airframe = {
  klass: "SLUG",
  layer: "Act",
  role: "Ground relay",
  method:
    "Slow drive to a relay point halfway toward the weakest friendly link. Mesh reach 2.6km. Sensor is only a few dozen meters. Does not engage.",
  linkFloor: 0.08,
  relayReach: 2600,
  fixedLink: false,
  protectRadius: 0,
  protectFloor: 0,
  recharge: 0,
  recover: "dock",
  launchable: false,
  brief: {
    proposition: "Drive a ground relay toward the weakest mesh link",
    stance: 0.6,
    reach: 0.08,
  },
  sense(asset, _contact, distance) {
    const span = Math.max(asset.sensor, 1);
    const p = 0.4 * asset.link * (1 - 0.3 * (distance / span));
    const sigma = 12 + 20 * (distance / span);
    return { p, sigma };
  },
  aim(_world, asset) {
    return asset.task?.waypoint ?? asset.home;
  },
  launchTask(asset) {
    return { kind: "relay", waypoint: { ...asset.home } };
  },
};

export function slugRelay(world: World, slugAsset: Asset, weak: Asset): Task {
  const x = Math.max(80, Math.min(world.bounds.w - 80, (slugAsset.pos.x + weak.pos.x) / 2));
  const y = Math.max(80, Math.min(world.bounds.h - 80, (slugAsset.pos.y + weak.pos.y) / 2));
  return { kind: "relay", waypoint: { x, y } };
}

export function weakestLink(world: World): Asset | undefined {
  return [...world.assets]
    .filter((a) => a.klass !== "SLUG" && (a.status === "airborne" || a.status === "lost-link"))
    .sort((a, b) => a.link - b.link || dist(a.pos, b.pos) - dist(a.pos, b.pos))[0];
}

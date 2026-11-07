import { fnv1a } from "../rng.ts";
import type { Asset, AssetClass, Contact, Task, Vec2, World } from "../types.ts";

export interface ConjureBrief {
  /** The plan under rehearsal. Not a person. */
  proposition: string;
  /** Direction that plan pushes in the synthetic room, −1 to +1. */
  stance: number;
  /** Share of the room that hears the plan directly. */
  reach: number;
}

export interface SenseHit {
  p: number;
  sigma: number;
}

export interface Airframe {
  klass: AssetClass;
  layer: "Observe" | "Act";
  role: string;
  method: string;
  linkFloor: number;
  relayReach: number;
  fixedLink: boolean;
  /** Meters. Friendly links inside this bubble are held at protectFloor. */
  protectRadius: number;
  protectFloor: number;
  /** Battery restored per second while an aircraft is docked on FLOWER. */
  recharge: number;
  recover: "dock" | "cap";
  launchable: boolean;
  brief: ConjureBrief;
  sense(asset: Asset, contact: Contact, distance: number): SenseHit | null;
  aim(world: World, asset: Asset): Vec2;
  launchTask(asset: Asset, cell: Vec2): Task;
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function loiter(world: World, asset: Asset, radius: number): Vec2 {
  const wp = asset.task?.waypoint ?? asset.home;
  const ang = world.tick * 0.12 + (fnv1a(asset.id) % 628) / 100;
  return { x: wp.x + Math.cos(ang) * radius, y: wp.y + Math.sin(ang) * radius };
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

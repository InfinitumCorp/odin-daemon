import type { AssetClass } from "../types.ts";
import { azrail } from "./azrail.ts";
import { cherubim } from "./cherubim.ts";
import type { Airframe } from "./contract.ts";
import { eon } from "./eon.ts";
import { flower } from "./flower.ts";
import { orbis } from "./orbis.ts";
import { pollen } from "./pollen.ts";
import { seraphim } from "./seraphim.ts";
import { slug } from "./slug.ts";

export const AIRFRAMES: Record<AssetClass, Airframe> = {
  CHERUBIM: cherubim,
  SERAPHIM: seraphim,
  AZRAIL: azrail,
  POLLEN: pollen,
  FLOWER: flower,
  SLUG: slug,
  ORBIS: orbis,
  EON: eon,
};

export function airframe(klass: AssetClass): Airframe {
  return AIRFRAMES[klass];
}

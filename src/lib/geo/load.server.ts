import { decodeGeoIpList, decodeGeoSiteList, type GeoIpList, type GeoSiteList } from "./dat.ts";
import { geoDir } from "./settings.ts";

interface CachedLists {
  token: string;
  geoip: GeoIpList;
  geosite: GeoSiteList;
}

const cache = new Map<string, CachedLists>();

export async function loadGeoDatasets(
  dir = geoDir(),
): Promise<{ geoip: GeoIpList; geosite: GeoSiteList } | null> {
  try {
    const { readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const geoipPath = join(dir, "geoip.dat");
    const geositePath = join(dir, "geosite.dat");
    const geoipStat = statSync(geoipPath);
    const geositeStat = statSync(geositePath);
    const token = `${geoipStat.mtimeMs}:${geoipStat.size}:${geositeStat.mtimeMs}:${geositeStat.size}`;
    const hit = cache.get(dir);
    if (hit?.token === token) return hit;
    const geoip = decodeGeoIpList(new Uint8Array(readFileSync(geoipPath)));
    const geosite = decodeGeoSiteList(new Uint8Array(readFileSync(geositePath)));
    const next = { token, geoip, geosite };
    cache.set(dir, next);
    return next;
  } catch (error) {
    cache.delete(dir);
    if (!isMissing(error)) console.error("[geo] datasets unavailable");
    return null;
  }
}

export function clearGeoDatasetCache(): void {
  cache.clear();
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

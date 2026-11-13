import { annotateGeo, clientAddress, requestHost, type GeoNote } from "./hook.ts";
import { loadGeoDatasets } from "./load.server.ts";
import { geoDir, isGeoRoutingEnabled } from "./settings.ts";

let lastLog = "";

export async function currentGeoNote(peer?: {
  ip?: string | null;
  host?: string | null;
}): Promise<GeoNote | null> {
  const enabled = await isGeoRoutingEnabled();
  if (!enabled) return null;
  const datasets = await loadGeoDatasets(geoDir());
  const note = annotateGeo({
    enabled: true,
    ip: peer?.ip,
    host: peer?.host,
    geoip: datasets?.geoip ?? null,
    geosite: datasets?.geosite ?? null,
  });
  if (note) logGeo(note);
  return note;
}

export async function withGeoTrace<T extends object>(trace: T): Promise<T & { geo?: GeoNote }> {
  const note = await currentGeoNote();
  if (!note) return trace;
  return { ...trace, geo: note };
}

export function peerFromRequest(request: Request): { ip: string | null; host: string | null } {
  return {
    ip: clientAddress(request.headers),
    host: requestHost(request.url),
  };
}

export function resetGeoLogState(): void {
  lastLog = "";
}

function logGeo(note: GeoNote): void {
  const line = `[geo] policy=${note.policy} datasets=${note.datasets} country=${note.country ?? "-"} categories=${note.categories.join(",") || "-"}`;
  if (line === lastLog) return;
  lastLog = line;
  console.info(line);
}

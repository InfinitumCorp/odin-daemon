import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ON = new Set(["1", "true", "on", "yes"]);

export interface GeoRoutingStatus {
  enabled: boolean;
  /** True when INFINITUM_GEO_ENABLED is set and overrides the saved toggle. */
  locked: boolean;
  persisted: boolean;
}

export function parseGeoEnabled(value: string): boolean {
  return ON.has(value.trim().toLowerCase());
}

export function geoDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.INFINITUM_GEO_DIR?.trim();
  if (override) return override;
  return join(dirname(fileURLToPath(import.meta.url)), "../../../data/geo");
}

export async function geoRoutingStatus(
  env: NodeJS.ProcessEnv = process.env,
  dir = geoDir(env),
): Promise<GeoRoutingStatus> {
  const raw = env.INFINITUM_GEO_ENABLED;
  const locked = typeof raw === "string" && raw.trim() !== "";
  const persisted = await readPersisted(dir);
  return {
    enabled: locked ? parseGeoEnabled(raw ?? "") : persisted,
    locked,
    persisted,
  };
}

export async function isGeoRoutingEnabled(
  env: NodeJS.ProcessEnv = process.env,
  dir = geoDir(env),
): Promise<boolean> {
  return (await geoRoutingStatus(env, dir)).enabled;
}

export async function writeGeoRouting(enabled: boolean, dir = geoDir()): Promise<void> {
  const { mkdirSync, renameSync, writeFileSync } = await import("node:fs");
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, "settings.json");
  const partial = join(dir, `.settings.${process.pid}.partial`);
  try {
    writeFileSync(partial, `${JSON.stringify({ geoRouting: enabled }, null, 2)}\n`);
    renameSync(partial, dest);
  } catch (error) {
    const { rmSync } = await import("node:fs");
    rmSync(partial, { force: true });
    throw error;
  }
}

async function readPersisted(dir: string): Promise<boolean> {
  try {
    const { readFileSync } = await import("node:fs");
    const parsed = JSON.parse(readFileSync(join(dir, "settings.json"), "utf8")) as {
      geoRouting?: unknown;
    };
    return parsed.geoRouting === true;
  } catch {
    return false;
  }
}

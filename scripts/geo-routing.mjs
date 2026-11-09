#!/usr/bin/env node
/**
 * Persist the geo-routing toggle. Default is off.
 *
 *   node scripts/geo-routing.mjs --geo-routing=on
 *   node scripts/geo-routing.mjs --geo-routing=off
 *   node scripts/geo-routing.mjs --status
 *
 * Writes data/geo/settings.json (gitignored). INFINITUM_GEO_ENABLED overrides
 * the file when the process starts with that variable set.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function geoSettingsPath(env = process.env) {
  const override = env.INFINITUM_GEO_DIR?.trim();
  const dir = override || join(ROOT, "data", "geo");
  return join(dir, "settings.json");
}

export function readGeoRoutingFile(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed?.geoRouting === true;
  } catch {
    return false;
  }
}

export function writeGeoRoutingFile(path, enabled) {
  mkdirSync(dirname(path), { recursive: true });
  const partial = `${path}.partial`;
  writeFileSync(partial, `${JSON.stringify({ geoRouting: enabled }, null, 2)}\n`);
  renameSync(partial, path);
}

export function applyGeoRoutingArg(argv, path) {
  const arg = argv[0];
  if (arg === "--geo-routing=on" || arg === "--enable" || arg === "--on") {
    writeGeoRoutingFile(path, true);
    return "on";
  }
  if (arg === "--geo-routing=off" || arg === "--disable" || arg === "--off") {
    writeGeoRoutingFile(path, false);
    return "off";
  }
  if (arg === "--status" || arg === undefined) {
    return readGeoRoutingFile(path) ? "on" : "off";
  }
  throw new Error("usage: node scripts/geo-routing.mjs --geo-routing=on|off|--status");
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entry === import.meta.url) {
  try {
    const state = applyGeoRoutingArg(process.argv.slice(2), geoSettingsPath());
    console.log(`geo routing ${state}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

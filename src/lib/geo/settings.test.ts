import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { geoRoutingStatus, parseGeoEnabled, writeGeoRouting } from "./settings.ts";

test("parseGeoEnabled accepts the on words and rejects everything else", () => {
  for (const value of ["1", "true", "TRUE", "on", "yes"])
    assert.equal(parseGeoEnabled(value), true);
  for (const value of ["", "0", "false", "off", "no", "maybe"])
    assert.equal(parseGeoEnabled(value), false);
});

test("the saved geo-routing toggle defaults off and can be overridden", async () => {
  const dir = mkdtempSync(join(tmpdir(), "geo-settings-"));
  const unset = {} as NodeJS.ProcessEnv;
  try {
    assert.deepEqual(await geoRoutingStatus(unset, dir), {
      enabled: false,
      locked: false,
      persisted: false,
    });
    await writeGeoRouting(true, dir);
    assert.equal((await geoRoutingStatus(unset, dir)).enabled, true);
    await writeGeoRouting(false, dir);
    assert.equal((await geoRoutingStatus(unset, dir)).persisted, false);
    const lockedOff = { INFINITUM_GEO_ENABLED: "0" } as NodeJS.ProcessEnv;
    await writeGeoRouting(true, dir);
    assert.equal((await geoRoutingStatus(lockedOff, dir)).enabled, false);
    assert.equal((await geoRoutingStatus(lockedOff, dir)).locked, true);
    const lockedOn = { INFINITUM_GEO_ENABLED: "on" } as NodeJS.ProcessEnv;
    assert.equal((await geoRoutingStatus(lockedOn, dir)).enabled, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

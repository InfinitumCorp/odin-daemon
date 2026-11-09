import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { applyGeoRoutingArg, readGeoRoutingFile } from "./geo-routing.mjs";

test("the geo-routing flag persists on and off, default off", () => {
  const dir = mkdtempSync(join(tmpdir(), "geo-flag-"));
  const path = join(dir, "settings.json");
  try {
    assert.equal(applyGeoRoutingArg(["--status"], path), "off");
    assert.equal(readGeoRoutingFile(path), false);
    assert.equal(applyGeoRoutingArg(["--geo-routing=on"], path), "on");
    assert.equal(JSON.parse(readFileSync(path, "utf8")).geoRouting, true);
    assert.equal(applyGeoRoutingArg(["--geo-routing=off"], path), "off");
    assert.equal(JSON.parse(readFileSync(path, "utf8")).geoRouting, false);
    assert.equal(applyGeoRoutingArg(["--enable"], path), "on");
    assert.equal(applyGeoRoutingArg(["--disable"], path), "off");
    assert.throws(() => applyGeoRoutingArg(["--geo-routing=maybe"], path), /usage/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { makeScenario } from "../odin/scenario.ts";
import { stepWorld } from "../odin/step.ts";
import { handleDaemonRequest } from "../odin/http.server.ts";
import { cidr, domain, geoIpEntry, geoIpList, geoSiteEntry, geoSiteList } from "./fixture.ts";
import { annotateGeo } from "./hook.ts";
import { clearGeoDatasetCache, loadGeoDatasets } from "./load.server.ts";
import { currentGeoNote, resetGeoLogState } from "./hook.server.ts";
import { decodeGeoIpList, decodeGeoSiteList } from "./dat.ts";

const previousEnabled = process.env.INFINITUM_GEO_ENABLED;
const previousDir = process.env.INFINITUM_GEO_DIR;

test("geo routing is inert while off and stays out of the exercise picture", async () => {
  const dir = mkdtempSync(join(tmpdir(), "geo-hook-"));
  process.env.INFINITUM_GEO_DIR = dir;
  try {
    process.env.INFINITUM_GEO_ENABLED = "0";
    resetGeoLogState();
    const off = await handleDaemonRequest(
      new Request("http://exercise.local/api/odin/health"),
      "health",
    );
    const offBody = (await off.json()) as { ok?: boolean; geo?: unknown; product?: string };
    assert.equal(offBody.ok, true);
    assert.equal(offBody.product, "ODIN°");
    assert.equal(offBody.geo, undefined);
    assert.equal(await currentGeoNote({ ip: "8.8.8.8", host: "ads.example" }), null);
    assert.equal(annotateGeo({ enabled: false, ip: "8.8.8.8", host: "ads.example" }), null);

    const hearth = () => makeScenario("hearth", 3);
    process.env.INFINITUM_GEO_ENABLED = "1";
    const enabledPicture = stepWorld(hearth(), []);
    process.env.INFINITUM_GEO_ENABLED = "0";
    assert.deepEqual(enabledPicture, stepWorld(hearth(), []));

    process.env.INFINITUM_GEO_ENABLED = "1";
    clearGeoDatasetCache();
    const missing = await currentGeoNote({ ip: "8.8.8.8", host: "ads.example" });
    assert.deepEqual(missing, {
      country: null,
      categories: [],
      policy: "annotate",
      datasets: "missing",
    });

    const geoip = geoIpList([geoIpEntry("us", [cidr([8, 8, 8, 8], 32)])]);
    const geosite = geoSiteList([geoSiteEntry("ads", [domain(2, "ads.example")])]);
    writeFileSync(join(dir, "geoip.dat"), geoip);
    writeFileSync(join(dir, "geosite.dat"), geosite);
    clearGeoDatasetCache();
    const loaded = await loadGeoDatasets(dir);
    assert.ok(loaded);
    assert.equal(decodeGeoIpList(geoip).entries[0]?.countryCode, "us");
    assert.equal(decodeGeoSiteList(geosite).entries[0]?.category, "ads");
    const note = await currentGeoNote({
      ip: "8.8.8.8",
      host: "https://track.ads.example/a",
    });
    assert.deepEqual(note, {
      country: "us",
      categories: ["ads"],
      policy: "annotate",
      datasets: "ready",
    });
    const health = await handleDaemonRequest(
      new Request("http://ads.example/api/odin/health", { headers: { "x-real-ip": "8.8.8.8" } }),
      "health",
    );
    const body = (await health.json()) as {
      geo?: { country: string | null; categories: string[] };
    };
    assert.equal(body.geo?.country, "us");
    assert.deepEqual(body.geo?.categories, ["ads"]);
    assert.deepEqual(stepWorld(hearth(), []), enabledPicture);
  } finally {
    if (previousEnabled === undefined) delete process.env.INFINITUM_GEO_ENABLED;
    else process.env.INFINITUM_GEO_ENABLED = previousEnabled;
    if (previousDir === undefined) delete process.env.INFINITUM_GEO_DIR;
    else process.env.INFINITUM_GEO_DIR = previousDir;
    clearGeoDatasetCache();
    resetGeoLogState();
    rmSync(dir, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  commitVerified,
  fetchOne,
  hashesAgree,
  loadLockfile,
  parseSha256Sum,
} from "./fetch-geo-dat.mjs";

const GEOIP_SHA = "eedb24b3b9fcba27e06b92c0428dab90d9496083091ae4cf39e11387fd99d0e2";
const GEOSITE_SHA = "dc4192dd1b644a38276ed06136d26e729fa674d25785adb38c87e040e92376b2";

test("lockfile pins the v2fly geoip and geosite releases", () => {
  const lock = loadLockfile();
  assert.equal(lock.publisher, "v2fly");
  assert.equal(lock.datasets.length, 2);
  const [geoip, geosite] = lock.datasets;
  assert.equal(geoip.filename, "geoip.dat");
  assert.equal(geoip.upstreamAsset, "geoip.dat");
  assert.equal(geoip.repo, "v2fly/geoip");
  assert.equal(geoip.tag, "202611080027");
  assert.equal(geoip.sha256, GEOIP_SHA);
  assert.equal(geoip.license, "CC-BY-SA-4.0");
  assert.equal(geosite.filename, "geosite.dat");
  assert.equal(geosite.upstreamAsset, "dlc.dat");
  assert.equal(geosite.repo, "v2fly/domain-list-community");
  assert.equal(geosite.tag, "20261108011013");
  assert.equal(geosite.sha256, GEOSITE_SHA);
  assert.equal(geosite.license, "MIT");
  for (const dataset of lock.datasets) {
    assert.match(dataset.url, /^https:\/\/github\.com\/v2fly\//);
    assert.match(dataset.sha256Url, /^https:\/\/github\.com\/v2fly\//);
    assert.doesNotMatch(
      `${dataset.url} ${dataset.sha256Url} ${dataset.repo}`,
      /loyalsoldier|sing-box|sagernet/i,
    );
  }
});

test("parseSha256Sum reads the official asset line", () => {
  assert.equal(parseSha256Sum(`${GEOIP_SHA}  geoip.dat\n`, "geoip.dat"), GEOIP_SHA);
  assert.equal(parseSha256Sum(`${GEOSITE_SHA} *dlc.dat\n`, "dlc.dat"), GEOSITE_SHA);
  assert.throws(
    () => parseSha256Sum(`${GEOIP_SHA}  other.dat\n`, "geoip.dat"),
    /expected geoip\.dat/,
  );
});

test("checksum mismatch refuses to write the dataset", () => {
  const dir = mkdtempSync(join(tmpdir(), "geo-mismatch-"));
  const dest = join(dir, "geoip.dat");
  try {
    assert.throws(
      () => commitVerified(dest, Buffer.from("not-the-list"), GEOIP_SHA),
      /checksum mismatch/,
    );
    assert.equal(existsSync(dest), false);
    assert.equal(existsSync(`${dest}.partial`), false);
    assert.throws(() => hashesAgree("ab".repeat(32), GEOIP_SHA, "geoip.dat"), /checksum mismatch/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a matching checksum is the only path that writes the file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "geo-match-"));
  const bytes = Buffer.from("synthetic-geo-bytes");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const dataset = {
    filename: "geoip.dat",
    upstreamAsset: "geoip.dat",
    repo: "v2fly/geoip",
    tag: "test",
    url: "https://github.com/v2fly/geoip/releases/download/test/geoip.dat",
    sha256Url: "https://github.com/v2fly/geoip/releases/download/test/geoip.dat.sha256sum",
    sha256: hash,
    license: "CC-BY-SA-4.0",
    maxBytes: 1024,
  };
  const fetchImpl = async (url) => {
    const body = url.endsWith(".sha256sum") ? Buffer.from(`${hash}  geoip.dat\n`) : bytes;
    return {
      ok: true,
      status: 200,
      url,
      headers: { get: (name) => (name === "content-length" ? String(body.length) : null) },
      arrayBuffer: async () =>
        body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    };
  };
  try {
    const dest = await fetchOne(dataset, dir, fetchImpl);
    assert.equal(readFileSync(dest).equals(bytes), true);
    const wrong = { ...dataset, sha256: GEOIP_SHA };
    await assert.rejects(() => fetchOne(wrong, dir, fetchImpl), /checksum mismatch/);
    assert.equal(readFileSync(dest).equals(bytes), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

#!/usr/bin/env node
/**
 * Download the pinned v2fly geoip.dat and geosite.dat lists into data/geo/.
 * The official .sha256sum asset must match the lockfile and the bytes.
 * A mismatch deletes any partial file and exits non-zero. The binaries are
 * never written into git.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOCK_PATH = join(ROOT, "geo", "geo-dat.lock.json");
const ALLOWED_HOSTS = new Set([
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "github-releases.githubusercontent.com",
]);

export function loadLockfile(path = LOCK_PATH) {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (!parsed || !Array.isArray(parsed.datasets) || parsed.datasets.length === 0) {
    throw new Error("geo lockfile has no datasets");
  }
  return {
    version: parsed.version,
    publisher: parsed.publisher,
    datasets: parsed.datasets.map(validateDataset),
  };
}

function validateDataset(entry) {
  const required = [
    "filename",
    "upstreamAsset",
    "repo",
    "tag",
    "url",
    "sha256Url",
    "sha256",
    "license",
    "maxBytes",
  ];
  for (const key of required) {
    if (entry?.[key] === undefined || entry[key] === "") {
      throw new Error(`geo lockfile entry is missing ${key}`);
    }
  }
  if (!/^v2fly\/[A-Za-z0-9._-]+$/.test(entry.repo)) {
    throw new Error(`geo lockfile repo is not a v2fly project: ${entry.repo}`);
  }
  if (!/^[0-9a-f]{64}$/.test(entry.sha256)) {
    throw new Error(`geo lockfile sha256 is not 64 hex chars for ${entry.filename}`);
  }
  assertAllowedUrl(entry.url);
  assertAllowedUrl(entry.sha256Url);
  if (!entry.url.startsWith(`https://github.com/${entry.repo}/releases/download/${entry.tag}/`)) {
    throw new Error(`geo lockfile url is outside ${entry.repo} tag ${entry.tag}`);
  }
  const maxBytes = Number(entry.maxBytes);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 40_000_000) {
    throw new Error(`geo lockfile maxBytes is out of range for ${entry.filename}`);
  }
  return { ...entry, sha256: entry.sha256.toLowerCase(), maxBytes };
}

export function assertAllowedUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`refusing non-https download: ${url.protocol}`);
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error(`refusing download host ${url.hostname}`);
  return url;
}

export function parseSha256Sum(text, expectedName) {
  const line = String(text)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item && !item.startsWith("#"));
  if (!line) throw new Error("official sha256sum asset is empty");
  const match = /^([0-9a-fA-F]{64})\s+\*?(\S+)$/.exec(line);
  if (!match) throw new Error(`official sha256sum asset is unreadable: ${line}`);
  const hash = match[1].toLowerCase();
  const name = match[2];
  if (expectedName && name !== expectedName) {
    throw new Error(`official sha256sum names ${name}, expected ${expectedName}`);
  }
  return hash;
}

export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function hashesAgree(leftHash, rightHash, label) {
  const left = leftHash.trim().toLowerCase();
  const right = rightHash.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(left) || !/^[0-9a-f]{64}$/.test(right)) {
    throw new Error(`${label} checksum mismatch`);
  }
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error(`${label} checksum mismatch: ${left} != ${right}`);
  }
}

export function commitVerified(dest, bytes, expectedHash) {
  const actual = sha256Hex(bytes);
  try {
    hashesAgree(actual, expectedHash, dest);
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : "checksum mismatch"}. Refusing to write ${dest}`,
    );
  }
  mkdirSync(dirname(dest), { recursive: true });
  const partial = `${dest}.partial`;
  try {
    writeFileSync(partial, bytes);
    const written = sha256Hex(readFileSync(partial));
    hashesAgree(written, expectedHash, partial);
    renameSync(partial, dest);
  } catch (error) {
    rmSync(partial, { force: true });
    throw error;
  }
}

export function geoDataDir() {
  const override = process.env.INFINITUM_GEO_DIR?.trim();
  if (override) return override;
  return join(ROOT, "data", "geo");
}

async function download(url, limit, fetchImpl) {
  assertAllowedUrl(url);
  const response = await fetchImpl(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(120_000),
    headers: { "user-agent": "odin-daemon-geo-fetch" },
  });
  assertAllowedUrl(response.url);
  if (!response.ok) throw new Error(`download failed ${response.status} for ${url}`);
  const declared = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > limit) {
    throw new Error(`download exceeds ${limit} bytes: ${url}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > limit) throw new Error(`download exceeds ${limit} bytes: ${url}`);
  return bytes;
}

export async function fetchOne(dataset, destDir, fetchImpl = globalThis.fetch) {
  const sumBytes = await download(dataset.sha256Url, 4096, fetchImpl);
  const official = parseSha256Sum(sumBytes.toString("utf8"), dataset.upstreamAsset);
  try {
    hashesAgree(official, dataset.sha256, dataset.filename);
  } catch {
    throw new Error(
      `checksum mismatch for ${dataset.filename}: official ${official} lockfile ${dataset.sha256}. Refusing to write the dataset.`,
    );
  }
  const bytes = await download(dataset.url, dataset.maxBytes, fetchImpl);
  const actual = sha256Hex(bytes);
  try {
    hashesAgree(actual, official, dataset.filename);
  } catch {
    throw new Error(
      `checksum mismatch for ${dataset.filename}: downloaded ${actual} official ${official}. Refusing to write the dataset.`,
    );
  }
  const dest = join(destDir, dataset.filename);
  commitVerified(dest, bytes, official);
  return dest;
}

export async function fetchLockedDatasets(options = {}) {
  const lock = options.lock ?? loadLockfile(options.lockPath);
  const destDir = options.destDir ?? geoDataDir();
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const written = [];
  for (const dataset of lock.datasets) {
    written.push(await fetchOne(dataset, destDir, fetchImpl));
  }
  return written;
}

async function main() {
  const written = await fetchLockedDatasets();
  for (const path of written) console.log(`verified ${path}`);
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entry === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

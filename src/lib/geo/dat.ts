import { asBytes, asVarint, bytesToString, readFields } from "./protobuf.ts";

/** v2ray GeoIPList / GeoSiteList. Country and category lookups only. */

export interface Cidr {
  ip: Uint8Array;
  prefix: number;
}

export interface GeoIpEntry {
  countryCode: string;
  cidrs: Cidr[];
  inverseMatch: boolean;
}

export type DomainMatch = "plain" | "regex" | "domain" | "full";

export interface GeoDomain {
  type: DomainMatch;
  value: string;
}

export interface GeoSiteEntry {
  category: string;
  domains: GeoDomain[];
}

interface IndexedCidr {
  entryIndex: number;
  countryCode: string;
  ip: Uint8Array;
  prefix: number;
}

interface SiteIndex {
  full: Map<string, string[]>;
  domain: Map<string, string[]>;
  plain: { value: string; category: string }[];
  regex: { re: RegExp; category: string }[];
}

export interface GeoIpList {
  entries: GeoIpEntry[];
  v4Buckets: IndexedCidr[][];
  v4Wide: IndexedCidr[];
  v6Buckets: IndexedCidr[][];
  v6Wide: IndexedCidr[];
}

export interface GeoSiteList {
  entries: GeoSiteEntry[];
  index: SiteIndex;
}

export function decodeGeoIpList(bytes: Uint8Array): GeoIpList {
  const entries: GeoIpEntry[] = [];
  for (const field of readFields(bytes)) {
    if (field.field === 1 && field.wire === 2) entries.push(decodeGeoIp(asBytes(field.value)));
  }
  return indexGeoIp(entries);
}

export function decodeGeoSiteList(bytes: Uint8Array): GeoSiteList {
  const entries: GeoSiteEntry[] = [];
  for (const field of readFields(bytes)) {
    if (field.field === 1 && field.wire === 2) entries.push(decodeGeoSite(asBytes(field.value)));
  }
  return { entries, index: indexSites(entries) };
}

export function lookupCountry(list: GeoIpList, ip: string): string | null {
  const bytes = parseIp(ip);
  if (!bytes) return null;
  if (bytes.length === 4) return firstCountry(list.v4Wide, list.v4Buckets[bytes[0]] ?? [], bytes);
  return firstCountry(list.v6Wide, list.v6Buckets[bytes[0]] ?? [], bytes);
}

/** One GeoIP entry, including inverse_match. Country lookup skips inverse entries. */
export function matchesGeoIp(entry: GeoIpEntry, ip: string): boolean {
  const bytes = parseIp(ip);
  if (!bytes) return false;
  const hit = entry.cidrs.some((cidr) => cidrContains(cidr, bytes));
  return entry.inverseMatch ? !hit : hit;
}

export function lookupCategories(list: GeoSiteList, domain: string): string[] {
  const host = normalizeDomain(domain);
  if (!host) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (categories?: string[]) => {
    if (!categories) return;
    for (const category of categories) {
      if (seen.has(category)) continue;
      seen.add(category);
      out.push(category);
    }
  };
  add(list.index.full.get(host));
  let rest = host;
  while (rest) {
    add(list.index.domain.get(rest));
    const dot = rest.indexOf(".");
    if (dot < 0) break;
    rest = rest.slice(dot + 1);
  }
  for (const item of list.index.plain) {
    if (item.value && host.includes(item.value)) add([item.category]);
  }
  for (const item of list.index.regex) {
    if (item.re.test(host)) add([item.category]);
  }
  return out;
}

export function normalizeDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;
  if (value.includes("://")) {
    try {
      value = new URL(value).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
  if (value.startsWith("[") && value.includes("]")) return null;
  if (value.endsWith(".")) value = value.slice(0, -1);
  const colon = value.lastIndexOf(":");
  if (colon > -1 && /^\d+$/.test(value.slice(colon + 1))) value = value.slice(0, colon);
  if (!value || value.includes("/") || /\s/.test(value)) return null;
  return value;
}

export function parseIp(input: string): Uint8Array | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith("[") && value.endsWith("]")) value = value.slice(1, -1);
  const zone = value.indexOf("%");
  if (zone >= 0) value = value.slice(0, zone);
  if (value.includes(":")) return parseV6(value);
  return parseV4(value);
}

function decodeGeoIp(bytes: Uint8Array): GeoIpEntry {
  let countryCode = "";
  const cidrs: Cidr[] = [];
  let inverseMatch = false;
  for (const field of readFields(bytes)) {
    if (field.field === 1 && field.wire === 2) countryCode = bytesToString(asBytes(field.value));
    else if (field.field === 2 && field.wire === 2) cidrs.push(decodeCidr(asBytes(field.value)));
    else if (field.field === 3 && field.wire === 0) inverseMatch = asVarint(field.value) !== 0n;
  }
  return { countryCode, cidrs, inverseMatch };
}

function decodeCidr(bytes: Uint8Array): Cidr {
  let ip = new Uint8Array();
  let prefix = 0;
  for (const field of readFields(bytes)) {
    if (field.field === 1 && field.wire === 2) ip = Uint8Array.from(asBytes(field.value));
    else if (field.field === 2 && field.wire === 0) prefix = Number(asVarint(field.value));
  }
  return { ip, prefix };
}

function decodeGeoSite(bytes: Uint8Array): GeoSiteEntry {
  let category = "";
  const domains: GeoDomain[] = [];
  for (const field of readFields(bytes)) {
    if (field.field === 1 && field.wire === 2) category = bytesToString(asBytes(field.value));
    else if (field.field === 2 && field.wire === 2) {
      const domain = decodeDomain(asBytes(field.value));
      if (domain) domains.push(domain);
    }
  }
  return { category, domains };
}

function decodeDomain(bytes: Uint8Array): GeoDomain | null {
  let type = 0;
  let value = "";
  for (const field of readFields(bytes)) {
    if (field.field === 1 && field.wire === 0) type = Number(asVarint(field.value));
    else if (field.field === 2 && field.wire === 2) value = bytesToString(asBytes(field.value));
  }
  if (!value) return null;
  const kind: DomainMatch | null =
    type === 0
      ? "plain"
      : type === 1
        ? "regex"
        : type === 2
          ? "domain"
          : type === 3
            ? "full"
            : null;
  if (!kind) return null;
  return { type: kind, value: kind === "regex" ? value : value.toLowerCase() };
}

function indexGeoIp(entries: GeoIpEntry[]): GeoIpList {
  const v4Buckets = emptyBuckets();
  const v6Buckets = emptyBuckets();
  const v4Wide: IndexedCidr[] = [];
  const v6Wide: IndexedCidr[] = [];
  entries.forEach((entry, entryIndex) => {
    if (!entry.countryCode || entry.inverseMatch) return;
    for (const cidr of entry.cidrs) {
      if (cidr.ip.length !== 4 && cidr.ip.length !== 16) continue;
      if (!Number.isSafeInteger(cidr.prefix) || cidr.prefix < 0) continue;
      const item: IndexedCidr = {
        entryIndex,
        countryCode: entry.countryCode,
        ip: cidr.ip,
        prefix: cidr.prefix,
      };
      const buckets = cidr.ip.length === 4 ? v4Buckets : v6Buckets;
      const wide = cidr.ip.length === 4 ? v4Wide : v6Wide;
      const width = cidr.ip.length * 8;
      if (cidr.prefix < 8 || cidr.prefix > width) wide.push(item);
      else buckets[cidr.ip[0] & 0xff].push(item);
    }
  });
  return { entries, v4Buckets, v4Wide, v6Buckets, v6Wide };
}

function emptyBuckets(): IndexedCidr[][] {
  return Array.from({ length: 256 }, () => []);
}

function firstCountry(
  wide: IndexedCidr[],
  bucket: IndexedCidr[],
  bytes: Uint8Array,
): string | null {
  let i = 0;
  let j = 0;
  let index = -1;
  let country = "";
  let matched = false;
  const consider = (item: IndexedCidr): boolean => {
    if (item.entryIndex !== index) {
      if (matched) return true;
      index = item.entryIndex;
      country = item.countryCode;
      matched = false;
    }
    if (!matched && cidrContains(item, bytes)) matched = true;
    return false;
  };
  while (i < wide.length && j < bucket.length) {
    const item = wide[i].entryIndex <= bucket[j].entryIndex ? wide[i++] : bucket[j++];
    if (consider(item)) return country;
  }
  while (i < wide.length) if (consider(wide[i++])) return country;
  while (j < bucket.length) if (consider(bucket[j++])) return country;
  return matched ? country : null;
}

function cidrContains(cidr: { ip: Uint8Array; prefix: number }, ip: Uint8Array): boolean {
  if (cidr.ip.length !== ip.length) return false;
  const bits = cidr.prefix;
  const width = ip.length * 8;
  if (bits <= 0) return true;
  if (bits > width) return false;
  const full = Math.floor(bits / 8);
  const rem = bits % 8;
  for (let i = 0; i < full; i++) if (cidr.ip[i] !== ip[i]) return false;
  if (rem === 0) return true;
  const mask = (0xff << (8 - rem)) & 0xff;
  return (cidr.ip[full] & mask) === (ip[full] & mask);
}

function indexSites(entries: GeoSiteEntry[]): SiteIndex {
  const full = new Map<string, string[]>();
  const domain = new Map<string, string[]>();
  const plain: { value: string; category: string }[] = [];
  const regex: { re: RegExp; category: string }[] = [];
  for (const entry of entries) {
    if (!entry.category) continue;
    for (const item of entry.domains) {
      if (item.type === "full") pushCategory(full, item.value, entry.category);
      else if (item.type === "domain") pushCategory(domain, item.value, entry.category);
      else if (item.type === "plain") plain.push({ value: item.value, category: entry.category });
      else if (item.value.length <= 256) {
        try {
          regex.push({ re: new RegExp(item.value, "i"), category: entry.category });
        } catch {
          // A published expression that does not compile is skipped.
        }
      }
    }
  }
  return { full, domain, plain, regex };
}

function pushCategory(map: Map<string, string[]>, key: string, category: string): void {
  const found = map.get(key);
  if (!found) {
    map.set(key, [category]);
    return;
  }
  if (!found.includes(category)) found.push(category);
}

function parseV4(value: string): Uint8Array | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const out = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    if (!/^\d{1,3}$/.test(parts[i])) return null;
    if (parts[i].length > 1 && parts[i].startsWith("0")) return null;
    const octet = Number(parts[i]);
    if (!Number.isInteger(octet) || octet > 255) return null;
    out[i] = octet;
  }
  return out;
}

function parseV6(value: string): Uint8Array | null {
  if (!value || value.includes(":::")) return null;
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const parseSide = (side: string): number[] | null => {
    if (!side) return [];
    const parts = side.split(":");
    const out: number[] = [];
    for (const part of parts) {
      if (part.includes(".")) {
        const v4 = parseV4(part);
        if (!v4 || out.length > 6) return null;
        out.push((v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]);
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
      out.push(Number.parseInt(part, 16));
    }
    return out;
  };
  const head = parseSide(halves[0]);
  const tail = halves.length === 2 ? parseSide(halves[1]) : [];
  if (!head || !tail) return null;
  if (halves.length === 1 && head.length !== 8) return null;
  if (halves.length === 2 && head.length + tail.length > 8) return null;
  const groups =
    halves.length === 1
      ? head
      : [...head, ...Array(8 - head.length - tail.length).fill(0), ...tail];
  if (groups.length !== 8) return null;
  const out = new Uint8Array(16);
  groups.forEach((group, index) => {
    out[index * 2] = (group >> 8) & 0xff;
    out[index * 2 + 1] = group & 0xff;
  });
  return out;
}

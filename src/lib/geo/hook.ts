import { lookupCategories, lookupCountry, type GeoIpList, type GeoSiteList } from "./dat.ts";

/** Advisory geo note. It never changes the exercise picture. */
export interface GeoNote {
  country: string | null;
  categories: string[];
  policy: "annotate";
  datasets: "ready" | "missing";
}

export function annotateGeo(input: {
  enabled: boolean;
  ip?: string | null;
  host?: string | null;
  geoip?: GeoIpList | null;
  geosite?: GeoSiteList | null;
}): GeoNote | null {
  if (!input.enabled) return null;
  if (!input.geoip || !input.geosite) {
    return { country: null, categories: [], policy: "annotate", datasets: "missing" };
  }
  return {
    country: input.ip ? lookupCountry(input.geoip, input.ip) : null,
    categories: input.host ? lookupCategories(input.geosite, input.host) : [],
    policy: "annotate",
    datasets: "ready",
  };
}

/** Advisory only. This address is not used to grant or deny clearance. */
export function clientAddress(headers: { get(name: string): string | null }): string | null {
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && isIpLiteral(value)) return value;
  }
  return null;
}

export function requestHost(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

function isIpLiteral(value: string): boolean {
  if (value.includes(":")) return true;
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value);
}

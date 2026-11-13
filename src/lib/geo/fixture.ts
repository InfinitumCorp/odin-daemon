/** Builds tiny synthetic v2ray geo messages for tests. Not a dataset downloader. */

function varint(value: number): number[] {
  const out: number[] = [];
  let rest = value >>> 0;
  while (rest > 0x7f) {
    out.push((rest & 0x7f) | 0x80);
    rest >>>= 7;
  }
  out.push(rest);
  return out;
}

function tag(field: number, wire: number): number[] {
  return varint((field << 3) | wire);
}

function lengthDelimited(field: number, bytes: number[]): number[] {
  return [...tag(field, 2), ...varint(bytes.length), ...bytes];
}

function text(field: number, value: string): number[] {
  return lengthDelimited(field, [...Buffer.from(value, "utf8")]);
}

function unsigned(field: number, value: number): number[] {
  return [...tag(field, 0), ...varint(value)];
}

export function cidr(ip: number[], prefix: number): number[] {
  return [...lengthDelimited(1, ip), ...unsigned(2, prefix)];
}

export function geoIpEntry(country: string, cidrs: number[][], inverse = false): number[] {
  return [
    ...text(1, country),
    ...cidrs.flatMap((item) => lengthDelimited(2, item)),
    ...(inverse ? unsigned(3, 1) : []),
  ];
}

export function geoIpList(entries: number[][]): Uint8Array {
  return Uint8Array.from(entries.flatMap((entry) => lengthDelimited(1, entry)));
}

export function domain(type: number, value: string): number[] {
  return [...unsigned(1, type), ...text(2, value)];
}

export function geoSiteEntry(category: string, domains: number[][]): number[] {
  return [...text(1, category), ...domains.flatMap((item) => lengthDelimited(2, item))];
}

export function geoSiteList(entries: number[][]): Uint8Array {
  return Uint8Array.from(entries.flatMap((entry) => lengthDelimited(1, entry)));
}

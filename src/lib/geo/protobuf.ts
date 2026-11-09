/** Minimal protobuf reader for the v2ray geo messages. No schema compiler. */

export type ProtoValue = bigint | Uint8Array;

export interface ProtoField {
  field: number;
  wire: number;
  value: ProtoValue;
}

export function readFields(buf: Uint8Array): ProtoField[] {
  const fields: ProtoField[] = [];
  let offset = 0;
  while (offset < buf.length) {
    const tag = readVarint(buf, offset);
    offset = tag.offset;
    const field = Number(tag.value >> 3n);
    const wire = Number(tag.value & 7n);
    if (!Number.isSafeInteger(field) || field <= 0) throw new Error("invalid protobuf field");
    if (wire === 0) {
      const value = readVarint(buf, offset);
      offset = value.offset;
      fields.push({ field, wire, value: value.value });
    } else if (wire === 1) {
      fields.push({ field, wire, value: take(buf, offset, 8) });
      offset += 8;
    } else if (wire === 2) {
      const length = readVarint(buf, offset);
      offset = length.offset;
      const size = Number(length.value);
      if (!Number.isSafeInteger(size) || size < 0) throw new Error("invalid protobuf length");
      fields.push({ field, wire, value: take(buf, offset, size) });
      offset += size;
    } else if (wire === 5) {
      fields.push({ field, wire, value: take(buf, offset, 4) });
      offset += 4;
    } else {
      throw new Error(`unsupported protobuf wire type ${wire}`);
    }
  }
  return fields;
}

export function asBytes(value: ProtoValue): Uint8Array {
  if (typeof value === "bigint") throw new Error("expected protobuf bytes");
  return value;
}

export function asVarint(value: ProtoValue): bigint {
  if (typeof value !== "bigint") throw new Error("expected protobuf varint");
  return value;
}

export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function take(buf: Uint8Array, offset: number, size: number): Uint8Array {
  if (offset + size > buf.length) throw new Error("truncated protobuf field");
  return buf.slice(offset, offset + size);
}

function readVarint(buf: Uint8Array, offset: number): { value: bigint; offset: number } {
  let value = 0n;
  let shift = 0n;
  let cursor = offset;
  for (let i = 0; i < 10; i++) {
    if (cursor >= buf.length) throw new Error("truncated protobuf varint");
    const byte = buf[cursor++];
    value |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value, offset: cursor };
    shift += 7n;
  }
  throw new Error("protobuf varint is too long");
}

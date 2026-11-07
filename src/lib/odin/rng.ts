/** Mulberry32. State is a uint32 stored on the world so a step is pure. */

export function nextRng(state: number): { state: number; value: number } {
  let a = state | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { state: a >>> 0, value };
}

export function take(world: { rng: number }): number {
  const next = nextRng(world.rng);
  world.rng = next.state;
  return next.value;
}

export function fnv1a(text: string, hash = 0x811c9dc5): number {
  let h = hash >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

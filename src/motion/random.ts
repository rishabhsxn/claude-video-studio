// Seeded randomness. Math.random is banned in scenes because renders must be repeatable.

/** mulberry32 PRNG: returns a function producing floats in [0, 1). */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic hash of an integer to [0, 1). */
export const hash01 = (n: number) => mulberry32(n * 2654435761)();

/** Smooth 1D value noise in [-1, 1], seeded. */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash01(i + seed * 7919) * 2 - 1;
  const b = hash01(i + 1 + seed * 7919) * 2 - 1;
  return a + (b - a) * u;
}

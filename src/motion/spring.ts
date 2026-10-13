// Closed-form damped springs (step response), parameterised like Apple's springs:
// `response` is the undamped period in seconds, `damping` the damping ratio.
// Pure functions of time, so any frame can be rendered cold, in any order.

export type SpringPreset = { response: number; damping: number };

export const SPRINGS = {
  /** check-in dots, pills, tabs, counters: crisp, ~1.5 % overshoot */
  snappy: { response: 0.22, damping: 0.8 },
  /** cards, panels, camera: smooth */
  base: { response: 0.4, damping: 0.86 },
  /** headlines, logo lockup: weighty, no overshoot */
  heavy: { response: 0.5, damping: 1.0 },
} satisfies Record<string, SpringPreset>;

export type SpringName = keyof typeof SPRINGS;

const resolvePreset = (p: SpringName | SpringPreset): SpringPreset =>
  typeof p === "string" ? SPRINGS[p] : p;

/** Spring progress 0 → 1 at `t` seconds after its start (0 before the start). */
export function springAt(t: number, preset: SpringName | SpringPreset = "base"): number {
  if (t <= 0) return 0;
  const { response, damping: z } = resolvePreset(preset);
  const w0 = (2 * Math.PI) / response;
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
  }
  if (z === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const s = Math.sqrt(z * z - 1);
  const r1 = -w0 * (z - s);
  const r2 = -w0 * (z + s);
  return 1 + (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r1 - r2);
}

const cache = new Map<string, { half: number; settle: number }>();

/** Seconds until the spring first reaches 50 % (`half`) and stays within 0.5 % (`settle`). */
export function springTimes(preset: SpringName | SpringPreset = "base") {
  const p = resolvePreset(preset);
  const key = `${p.response}/${p.damping}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const dt = 1 / 600;
  let half = 0;
  let settle = 0;
  for (let t = dt; t < 5; t += dt) {
    const v = springAt(t, p);
    if (!half && v >= 0.5) half = t;
    if (Math.abs(1 - v) > 0.005) settle = t;
  }
  const out = { half, settle };
  cache.set(key, out);
  return out;
}

/** Interpolate between a and b with spring progress p (p may overshoot slightly). */
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/**
 * Superposition of springs: one spring per target change, never restarted, so a retarget
 * mid-flight keeps its velocity. keys: [{ at: seconds, value, preset? }], sorted by `at`;
 * a key's own preset overrides the default for the move into it.
 */
export function track(
  tSec: number,
  keys: { at: number; value: number; preset?: SpringName | SpringPreset }[],
  preset: SpringName | SpringPreset = "base",
): number {
  if (!keys.length) return 0;
  let v = keys[0].value;
  for (let i = 1; i < keys.length; i++) {
    v += (keys[i].value - keys[i - 1].value) * springAt(tSec - keys[i].at, keys[i].preset ?? preset);
  }
  return v;
}

/** A slow, weighty preset for big camera moves and pushes: ≥8 frames of visible travel at 30 fps. */
export const GLIDE: SpringPreset = { response: 0.9, damping: 1 };

/** Clamp to [0, 1]. Use for opacity driven by a spring that overshoots. */
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

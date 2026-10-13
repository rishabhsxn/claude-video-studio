import React from "react";
import { track, type SpringName, type SpringPreset } from "./spring";

// A 2D camera over a large UI "world" (CSS px). The camera is a focus point in world coordinates
// and a scale; the focus lands on a point of the frame (`anchor`, in frame px).
// Keys are retargeted with superposed springs (`track`), so a new move mid-flight keeps velocity.

export type CamKey = { at: number; x: number; y: number; s: number; preset?: SpringName | SpringPreset };

/** Camera state at time t (seconds) from keys sorted by `at` (seconds). */
export function camAt(t: number, keys: CamKey[], preset: SpringName | SpringPreset = "base") {
  const k = (f: (c: CamKey) => number) => track(t, keys.map((c) => ({ at: c.at, value: f(c), preset: c.preset })), preset);
  // Scale moves in log space so zooms feel even in both directions.
  return { x: k((c) => c.x), y: k((c) => c.y), s: Math.exp(k((c) => Math.log(c.s))) };
}

/** Scale that fits a world rect (w × h) into a frame rect (fw × fh). */
export const fit = (w: number, h: number, fw: number, fh: number) => Math.min(fw / w, fh / h);

/** Renders `children` (the world, CSS px, origin top-left) through the camera. */
export const Camera: React.FC<{
  x: number;
  y: number;
  s: number;
  anchor: [number, number];
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ x, y, s, anchor, style, children }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      transformOrigin: "0 0",
      transform: `translate(${(anchor[0] - x * s).toFixed(3)}px, ${(anchor[1] - y * s).toFixed(3)}px) scale(${s.toFixed(5)})`,
      ...style,
    }}
  >
    {children}
  </div>
);

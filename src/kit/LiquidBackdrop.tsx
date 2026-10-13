import React, { useMemo } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { useFilmFrame } from "../motion/timeline";
import { C } from "../theme";

// One large accent-coloured blob on near-black that morphs slowly and breathes in and out of focus,
// the liquid-gradient look of many AI launch films. Use it for one moment per film (usually the hook).
// Every parameter is periodic in `loopSec`, so the backdrop loops seamlessly.

type Harmonic = { k: number; amp: number; speed: number; phase: number };

type Props = {
  /** loop period in seconds; use the video duration (or a divisor) for a seamless loop */
  loopSec: number;
  /** blob centre in 0..1 of the frame, plus drift amplitude */
  center?: [number, number];
  drift?: [number, number];
  /** blob radius as a fraction of the frame's long side */
  radius?: number;
  /** blur range in px at a 1080 px short side: [sharpest, softest] */
  blur?: [number, number];
  /** colours: [inner, mid, edge] */
  colors?: [string, string, string];
  /** ground colour behind the blob */
  ground?: string;
  /** shift the shape's phase (to vary between shots without changing the loop) */
  seedPhase?: number;
};

const HARMONICS: Harmonic[] = [
  { k: 2, amp: 0.11, speed: 1, phase: 0.3 },
  { k: 3, amp: 0.07, speed: -2, phase: 1.7 },
  { k: 4, amp: 0.035, speed: 3, phase: 4.1 },
  { k: 5, amp: 0.02, speed: -1, phase: 2.6 },
];

const POINTS = 96;

/** Closed Catmull-Rom spline through points → SVG cubic Bézier path. */
function smoothPath(pts: [number, number][]) {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d + "Z";
}

export const LiquidBackdrop: React.FC<Props> = ({
  loopSec,
  center = [0.78, 0.5],
  drift = [0.16, 0.12],
  radius = 0.48,
  blur = [6, 90],
  colors = [C.accent400, C.accent, C.accentDeep],
  ground = C.ink,
  seedPhase = 0,
}) => {
  const frame = useFilmFrame();
  const { fps, width, height } = useVideoConfig();
  const u = Math.min(width, height) / 1080;
  const long = Math.max(width, height);
  const phi = (2 * Math.PI * frame) / (fps * loopSec) + seedPhase;

  const cx = width * (center[0] + drift[0] * Math.sin(phi + 0.6));
  const cy = height * (center[1] + drift[1] * Math.sin(2 * phi + 1.9));
  const r = long * radius * (1 + 0.06 * Math.sin(phi + 2.4));
  const spin = 0.35 * Math.sin(phi + 0.2);

  const path = useMemo(() => {
    const pts: [number, number][] = [];
    for (let i = 0; i < POINTS; i++) {
      const th = (i / POINTS) * Math.PI * 2;
      let rr = 1;
      for (const h of HARMONICS) rr += h.amp * Math.sin(h.k * (th + spin) + h.speed * phi + h.phase);
      pts.push([cx + Math.cos(th) * r * rr, cy + Math.sin(th) * r * rr]);
    }
    return smoothPath(pts);
  }, [cx, cy, r, spin, phi]);

  // Focus breathing: eased so the edge lingers sharp, then melts.
  const focus = 0.5 + 0.5 * Math.sin(2 * phi + 0.8);
  const blurPx = (blur[0] + (blur[1] - blur[0]) * focus * focus) * u;
  const hx = cx - r * 0.25 * Math.cos(phi);
  const hy = cy - r * 0.3;

  return (
    <AbsoluteFill style={{ backgroundColor: ground }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="liquid-fill" gradientUnits="userSpaceOnUse" cx={hx} cy={hy} r={r * 1.25}>
            <stop offset="0" stopColor={colors[0]} />
            <stop offset="0.62" stopColor={colors[1]} />
            <stop offset="1" stopColor={colors[2]} />
          </radialGradient>
        </defs>
        <g style={{ filter: `blur(${blurPx.toFixed(2)}px)` }}>
          <path d={path} fill="url(#liquid-fill)" />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

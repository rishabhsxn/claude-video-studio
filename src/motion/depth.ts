// The one allowed non-2D transform: UI cards settle from a tilt toward a near-flat angle.
// Keep it on cards only; never on type or the logo.

/** CSS transform for a card tilt. `p` is spring progress 0 → 1. */
export function cardTilt(p: number, { from = 16, to = 3, perspective = 2400 } = {}) {
  const deg = from + (to - from) * p;
  return `perspective(${perspective}px) rotateX(${deg.toFixed(3)}deg)`;
}

/** Deep, soft contact shadow for UI cards on the dark ground (no glow). */
export const cardShadow = (u: number) =>
  `0 ${36 * u}px ${80 * u}px rgba(0,0,0,0.55), 0 ${8 * u}px ${18 * u}px rgba(0,0,0,0.35)`;

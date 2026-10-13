import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

// Fine film grain over the whole frame. The noise seed follows the frame number, so it is
// deterministic and changes every frame like real grain. Keep it outside motion blur.

export const Grain: React.FC<{ opacity?: number; size?: number }> = ({ opacity = 0.07, size = 0.9 }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  // At 30 fps drafts, reuse the 60 fps seed of the same moment so drafts and finals match.
  const seed = Math.floor((frame * 60) / fps) % 997;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <filter id="grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency={size} numOctaves={2} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width={width} height={height} filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

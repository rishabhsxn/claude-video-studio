import React from "react";
import { AbsoluteFill } from "remotion";
import { LiquidBackdrop } from "../../src/kit/LiquidBackdrop";
import { LogoLockup } from "../../src/kit/LogoLockup";
import { Shot, Stage, type VideoProps } from "../../src/kit/Stage";
import { useFormat } from "../../src/motion/format";
import { CONFIG, filled } from "../../src/config";
import { RiseText } from "../../src/motion/text";
import type { ResolvedTimeline } from "../../src/motion/timeline";
import { C, FONT } from "../../src/theme";
import resolved from "./timeline.resolved.json";

export const timeline = resolved as unknown as ResolvedTimeline;

// Setup test: a two-line headline, then your logo, app name and URL from studio.config.json.
// Works before setup too (placeholders fall back to neutral text).

const Headline: React.FC = () => {
  const f = useFormat();
  const size = f.pick(128, 118) * f.u;
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        paddingLeft: f.safe.left,
        paddingRight: f.width - f.safe.right,
        fontFamily: FONT.display,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.04,
        letterSpacing: "-0.035em",
      }}
    >
      <div style={{ color: C.text }}>
        <RiseText text="Made in code," at="open" exitAt="out" />
      </div>
      <div style={{ color: C.text }}>
        <RiseText text="on the beat." at="line2" exitAt="out+0.25" />
      </div>
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const f = useFormat();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 56 * f.u, flexDirection: "column" }}>
      <LogoLockup at="logo" wordAt="word" size={f.pick(150, 140) * f.u} pushFrom="logo" pushTo="end" />
      <div style={{ fontFamily: FONT.ui, fontWeight: 500, fontSize: 56 * f.u, color: C.text, letterSpacing: "0.01em" }}>
        <RiseText text={filled(CONFIG.appUrl, "yourapp.com")} at="url" preset="heavy" />
      </div>
    </AbsoluteFill>
  );
};

export const Component: React.FC<VideoProps> = ({ draft }) => {
  const f = useFormat();
  return (
    <Stage
      timeline={timeline}
      draft={draft}
      backdrop={
        <LiquidBackdrop
          loopSec={timeline.durationSec}
          center={f.pick([0.8, 0.5], [0.72, 0.66])}
          drift={f.pick([0.14, 0.12], [0.16, 0.08])}
          radius={f.pick(0.42, 0.4)}
        />
      }
    >
      <Shot id="S1" post={0.5}>
        <Headline />
      </Shot>
      <Shot id="S2" pre={0.5}>
        <EndCard />
      </Shot>
    </Stage>
  );
};

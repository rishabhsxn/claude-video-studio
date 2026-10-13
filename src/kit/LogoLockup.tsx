import React from "react";
import { Img, staticFile } from "remotion";
import { CONFIG, filled } from "../config";
import { springAt } from "../motion/spring";
import { useTimeline, type BeatRef } from "../motion/timeline";
import { C, FONT } from "../theme";

// Logo build for any single-colour SVG: the mark grows from 0.85 and rises through a mask on the
// beat, then the wordmark (the app name, or your own text) lifts in beside or under it.
// For a bespoke build (bars rising one by one, nodes popping), animate your logo's paths here instead.

type Props = {
  /** beat reference the mark reads on */
  at: BeatRef;
  /** beat reference the wordmark reads on (defaults to one beat after the mark) */
  wordAt?: BeatRef;
  /** mark height in px */
  size: number;
  /** wordmark text; defaults to the app name from studio.config.json, "" to hide it */
  word?: string;
  /** wordmark beside the mark (row) or under it (column) */
  direction?: "row" | "column";
  /** beat references where a slow push-in starts and ends */
  pushFrom?: BeatRef;
  pushTo?: BeatRef;
  color?: string;
};

export const LogoLockup: React.FC<Props> = ({
  at,
  wordAt,
  size,
  word = filled(CONFIG.appName, "Your app"),
  direction = "row",
  pushFrom,
  pushTo,
  color = C.text,
}) => {
  const { t, tl, hitStart, span } = useTimeline();
  const markStart = hitStart(at, "heavy");
  const wordStart = wordAt !== undefined ? hitStart(wordAt, "heavy") : markStart + tl.beatSec;
  const pm = springAt(t - markStart, "heavy");
  const pw = springAt(t - wordStart, "heavy");
  const push = pushFrom !== undefined && pushTo !== undefined ? span(pushFrom, pushTo) : 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: direction,
        alignItems: "center",
        gap: size * 0.32,
        scale: String(1 + 0.035 * push),
      }}
    >
      <div style={{ height: size * 1.1, overflow: "hidden", display: "flex", alignItems: "flex-end" }}>
        <div
          style={{
            width: size,
            height: size,
            translate: `0 ${((1 - pm) * size * 1.1).toFixed(2)}px`,
            scale: String(0.85 + 0.15 * Math.min(1, pm)),
            // the SVG is used as a mask, so any logo file renders in `color`
            backgroundColor: color,
            WebkitMaskImage: `url(${staticFile(CONFIG.logo)})`,
            WebkitMaskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
          }}
        >
          {/* keeps the file in the bundle's dependency graph for Studio's asset list */}
          <Img src={staticFile(CONFIG.logo)} style={{ display: "none" }} />
        </div>
      </div>
      {word ? (
        <div style={{ overflow: "hidden", paddingBottom: size * 0.08 }}>
          <div
            style={{
              fontFamily: FONT.display,
              fontWeight: 600,
              fontSize: size * 0.62,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              color,
              translate: `0 ${((1 - pw) * size * 0.8).toFixed(2)}px`,
            }}
          >
            {word}
          </div>
        </div>
      ) : null}
    </div>
  );
};

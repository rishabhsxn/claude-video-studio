import React from "react";
import { springAt, springTimes, type SpringName } from "./spring";
import { useTimeline, type BeatRef } from "./timeline";

type RiseTextProps = {
  text: string;
  /** beat reference the first word should READ on (hit lead is applied) */
  at: BeatRef;
  /** optional beat reference where the words lift out through the mask */
  exitAt?: BeatRef;
  preset?: SpringName;
  /** spring for the exit (defaults to `preset`); "base" clears a line faster and cleaner */
  exitPreset?: SpringName;
  /** lift the whole line as one unit and let it fade over the second half of the lift, so no lone
   *  descender or dot is left in a mask */
  exitAsLine?: boolean;
  /** seconds between words; 0 animates the whole line as one unit */
  stagger?: number;
  /** words drawn in the accent colour (match by exact word, punctuation stripped) */
  accentWords?: string[];
  accentColor?: string;
  style?: React.CSSProperties;
};

// room for descenders and accents inside each word's mask
const MASK_PAD = "0.2em";

/**
 * Words rise through a mask, starting 145 % of their height below it so no glyph tops peek
 * on the first frame. Exits lift through the same mask. No opacity fades.
 */
export const RiseText: React.FC<RiseTextProps> = ({
  text,
  at,
  exitAt,
  preset = "heavy",
  exitPreset,
  exitAsLine = false,
  stagger = 0.06,
  accentWords = [],
  accentColor,
  style,
}) => {
  const { t, hitStart, sec } = useTimeline();
  const words = text.split(/\s+/).filter(Boolean);
  const start = hitStart(at, preset);
  const out = exitPreset ?? preset;
  const exitStart = exitAt !== undefined ? sec(exitAt) - springTimes(out).half : Infinity;
  const accentSet = new Set(accentWords.map((w) => w.toLowerCase()));

  return (
    <span style={{ display: "inline", ...style }}>
      {words.map((w, i) => {
        const pIn = springAt(t - (start + i * stagger), preset);
        const pOut = springAt(t - (exitStart + (exitAsLine ? 0 : i * stagger * 0.5)), out);
        const fade = exitAsLine ? 1 - Math.min(1, Math.max(0, (pOut - 0.25) / 0.25)) : 1;
        const y = (1 - pIn) * 145 - pOut * 145;
        const plain = w.replace(/[^\p{L}\p{N}'-]/gu, "").toLowerCase();
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              overflow: "hidden",
              verticalAlign: "bottom",
              padding: `${MASK_PAD} 0.04em`,
              margin: `-${MASK_PAD} 0`,
            }}
          >
            <span
              style={{
                display: "inline-block",
                translate: `0 ${y.toFixed(3)}%`,
                color: accentSet.has(plain) ? accentColor : undefined,
                visibility: pIn <= 0 || pOut >= 1 ? "hidden" : "visible",
                opacity: fade < 1 ? fade : undefined,
              }}
            >
              {w}
            </span>
            {i < words.length - 1 ? " " : null}
          </span>
        );
      })}
    </span>
  );
};

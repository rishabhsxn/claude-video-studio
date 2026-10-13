import React from "react";
import { C, FONT, RADIUS } from "../../theme";

// Pattern for a ported UI component: plain props in (from a fixtures file), theme tokens for every
// colour and size, no data fetching and no animation of its own. Scenes animate it from the timeline.
// Replace with components ported from your app (see README.md in this folder).

type Props = {
  label: string;
  value: string;
  caption?: string;
  /** 0..1 progress for a value that counts up; the scene drives it from useTimeline() */
  progress?: number;
  scale?: number;
};

export const ExampleCard: React.FC<Props> = ({ label, value, caption, progress = 1, scale = 1 }) => (
  <div
    style={{
      width: 300 * scale,
      padding: 20 * scale,
      borderRadius: RADIUS.card * scale,
      background: C.surface2,
      border: `${scale}px solid ${C.border}`,
      fontFamily: FONT.ui,
      opacity: progress > 0 ? 1 : 0,
    }}
  >
    <div style={{ fontSize: 15 * scale, color: C.textMuted }}>{label}</div>
    <div style={{ fontSize: 34 * scale, fontWeight: 700, color: C.text, marginTop: 6 * scale }}>{value}</div>
    {caption ? <div style={{ fontSize: 13 * scale, color: C.textMuted, marginTop: 4 * scale }}>{caption}</div> : null}
  </div>
);

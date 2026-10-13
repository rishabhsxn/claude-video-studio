import React from "react";

// Numbers that change on screen. Tabular figures so widths do not jump.

/** One value rolls out upward through a mask while the next rises in (Dub-style masked digits). */
export const RollNumber: React.FC<{ from: number | string; to: number | string; p: number; style?: React.CSSProperties }> = ({ from, to, p, style }) => {
  const q = Math.max(0, Math.min(1.05, p));
  return (
    <span style={{ display: "inline-grid", overflow: "hidden", verticalAlign: "top", fontVariantNumeric: "tabular-nums", ...style }}>
      <span style={{ gridArea: "1 / 1", translate: `0 ${(-q * 105).toFixed(2)}%`, textAlign: "right" }}>{from}</span>
      <span style={{ gridArea: "1 / 1", translate: `0 ${((1 - q) * 105).toFixed(2)}%`, textAlign: "right" }}>{to}</span>
    </span>
  );
};

/** Count-up like the app's AnimatedValue: rounds a spring-driven value. */
export const countUp = (to: number, p: number) => Math.round(to * Math.max(0, Math.min(1, p)));

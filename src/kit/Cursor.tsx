import React from "react";
import { C } from "../theme";

// The pointer that drives UI changes (the twoclipping "cursor drives every change" grammar).
// `touch` on phone UI: a soft white fingertip dot that presses. `pointer` on desktop UI: the system arrow.
// Position and press come from the scene; size is in the UI's CSS pixels (it lives inside the camera).

type Props = { x: number; y: number; press?: number; variant?: "touch" | "pointer"; opacity?: number };

export const Cursor: React.FC<Props> = ({ x, y, press = 0, variant = "pointer", opacity = 1 }) => {
  if (opacity <= 0) return null;
  if (variant === "touch") {
    const r = 15 * (1 - 0.18 * press);
    return (
      <div
        style={{
          position: "absolute",
          left: x - r,
          top: y - r,
          width: r * 2,
          height: r * 2,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.82)",
          border: "1.5px solid rgba(255,255,255,0.95)",
          boxShadow: "0 3px 10px rgba(0,0,0,0.35)",
          opacity,
          pointerEvents: "none",
        }}
      />
    );
  }
  return (
    <svg
      width={22}
      height={30}
      viewBox="0 0 22 30"
      style={{ position: "absolute", left: x - 2, top: y - 1, opacity, scale: String(1 - 0.12 * press), transformOrigin: "2px 1px", overflow: "visible", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}
    >
      <path d="M2 1 L2 24 L7.5 18.5 L11.5 27.5 L15 26 L11 17.2 L18.8 17.2 Z" fill={C.text} stroke={C.ink} strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
};

import { useVideoConfig } from "remotion";

export type FormatId = "9x16" | "16x9";

export const FORMATS: Record<FormatId, { width: number; height: number }> = {
  "9x16": { width: 1080, height: 1920 },
  "16x9": { width: 1920, height: 1080 },
};

/**
 * Layout helpers for the current composition.
 * - `pick(wide, tall)`: re-block per format instead of cropping.
 * - `u`: 1 unit = 1 px on a 1080 px short side, so sizes written for 1080 scale to any render size.
 * - `safe`: the 9:16 platform-UI-free rectangle (top 14 %, bottom 20 %, right 12 % excluded);
 *   for 16:9 a plain 6 % margin.
 */
export function useFormat() {
  const { width, height } = useVideoConfig();
  const tall = height > width;
  const u = Math.min(width, height) / 1080;
  const safe = tall
    ? { left: width * 0.074, top: height * 0.14, right: width * 0.88, bottom: height * 0.8 }
    : { left: width * 0.06, top: height * 0.08, right: width * 0.94, bottom: height * 0.92 };
  return {
    width,
    height,
    tall,
    id: (tall ? "9x16" : "16x9") as FormatId,
    u,
    safe: { ...safe, width: safe.right - safe.left, height: safe.bottom - safe.top },
    pick: <T,>(wide: T, tallValue: T): T => (tall ? tallValue : wide),
  };
}

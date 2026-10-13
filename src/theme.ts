// Mirrors brand/frame.md. Scenes take every colour and font from here.
// FILL: replace these defaults with your brand's tokens (`/promo-video setup` does it from frame.md).
// The defaults are a working dark theme with one violet accent, so the smoke test renders before setup.
import { loadFont as loadInterTight } from "@remotion/google-fonts/InterTight";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";

export const C = {
  bg: "#0E1011", // video ground
  surface: "#212529", // app panels
  surface2: "#2B3035", // cards
  border: "#343A40",
  text: "#FFFFFF",
  textMuted: "#ADB5BD",
  accent: "#6741D9", // the one accent: buttons, fills, highlights
  accent400: "#8567E1", // lighter step: second headline line
  accentText: "#9980E6", // accent text on the dark ground (keep contrast ≥ 4.5:1)
  accent200: "#B9A8EE",
  accent100: "#D0C4F3", // lightest step: first headline line
  accentDeep: "#2B1B5B", // darkest step: backdrop edge
  ink: "#08070C", // backdrop black
} as const;

export const RADIUS = { lg: 8, md: 6, sm: 4, card: 12 } as const;

// FILL: your display and UI faces. Any @remotion/google-fonts family works; for a local font use @remotion/fonts.
const ui = loadRoboto("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });
const display = loadInterTight("normal", { weights: ["600"], subsets: ["latin"] });

export const FONT = {
  ui: ui.fontFamily,
  display: display.fontFamily,
} as const;

/** Title style: white, key word in accent-text, tight tracking. */
export const TITLE = { weight: 600, tracking: "-0.03em", color: C.text, accent: C.accentText } as const;

---
name: {{APP_NAME}}
source: {{WHERE_THE_TOKENS_COME_FROM}}   # e.g. tailwind.config.ts, src/styles/colors.ts, CSS variables
mirror: src/theme.ts (keep both in sync)
colors:
  bg: "{{HEX}}"            # video ground (dark grounds make UI and type pop)
  surface: "{{HEX}}"       # app panels
  surface-2: "{{HEX}}"     # cards
  border: "{{HEX}}"
  text: "{{HEX}}"
  text-muted: "{{HEX}}"
  accent: "{{HEX}}"        # the one accent: buttons, fills, highlights
  accent-400: "{{HEX}}"    # lighter step
  accent-text: "{{HEX}}"   # accent text on bg (contrast ≥ 4.5:1)
  accent-200: "{{HEX}}"
  accent-100: "{{HEX}}"    # lightest step
  accent-deep: "{{HEX}}"   # darkest step, backdrop edge
  ink: "{{HEX}}"           # backdrop black
typography:
  display: { family: "{{DISPLAY_FONT}}", weight: 600, tracking: "-0.03em" }   # titles
  ui: { family: "{{UI_FONT}}" }                                               # the app's own UI face
  wordmark: "{{WORDMARK_RULE}}"   # e.g. "use logo.svg, never type the name"
radius: { lg: 8, md: 6, sm: 4, card: 12 }   # FILL from the app
---

# How {{APP_NAME}} looks on screen

**Ground.** {{GROUND}} <!-- e.g. plain near-black with fine film grain; the app UI and the type carry the colour -->

**Backdrop.** `src/kit/LiquidBackdrop.tsx` (one soft morphing blob) is a spice, not the ground: one moment per
film at most, usually the hook.

**One accent.** `accent` carries every highlight. {{SECOND_COLOUR_RULE}} <!-- e.g. a brand gradient only on the logo moment -->

**Type.** Titles in the display face, sentence case, white with the key word in `accent-text`. UI text exactly as
the app sets it. On-screen words match the voiceover or are a shorter caption, never a paraphrase.

**Legibility on the backdrop.** Accent-coloured text never sits on the accent-coloured blob. Over the blob,
text is white; otherwise steer the blob (`center`, `drift`) so text sits on the dark side.

**UI.** {{UI_NOTES}} <!-- panels, cards, check states, chart colours: port the app's exact classes -->

**Depth.** UI cards may settle from a 12–18° tilt to ~3° (`src/motion/depth.ts`) with a deep soft shadow.
No glow, no bevels, no glass.

**Motion personality.** {{MOTION_PERSONALITY}} <!-- default: calm and precise, never bouncy -->

| Role | Spring preset | Feel |
|---|---|---|
| Dots, pills, tabs, counters | `snappy` (0.22 s / 0.80) | crisp, ~1.5 % overshoot |
| Cards, panels | `base` (0.40 s / 0.86) | smooth, settles fast |
| Card rise into a shot | 0.6 s / 1.00, scale 0.85→1 | lands, no pop |
| Camera glides, UI-to-UI moves | `GLIDE` (0.9 s / 1.00) | ≥8 frames of visible travel |
| Big pushes, pull-backs, scrolls | 1.3–1.6 s / 1.00 | slow, weighty; `base` reads as a jump cut |
| Headlines, logo lockup | `heavy` (0.50 s / 1.00) | no overshoot, weighty |

**End card.** {{END_CARD}} <!-- e.g. logo + tagline + URL pill; hold ≥1.5 s with a micro push -->

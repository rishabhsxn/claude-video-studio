# Motion and code patterns (Remotion, this kit)

## Time
- Author time in **beats** in `timeline.json`; scenes read the resolved file through `useTimeline()`:
  - `t` seconds now · `sec(ref)` · `frameOf(ref)` · `since(ref)`
  - `sp(ref, preset)` spring starting exactly at ref
  - `hit(ref, preset)` spring that **reads on** ref (starts max(3 frames, half-travel) early). Use it for
    anything with a sound or a beat.
  - `span(a, b)` linear 0..1 between two refs (camera drifts, pushes)
  - `track(t, keys, preset)` from `src/motion/spring.ts` for values retargeted several times
- References: `"logo"`, `"logo+0.5"`, `"hook-0.25"`, or a number of beats.
- At 120 BPM one beat = 0.5 s = 30 frames at 60 fps. Hard cuts on bar lines (every 4 beats); inner events
  on beats or half-beats.

## Springs (`src/motion/spring.ts`)
| Preset | Use | Half-travel | Settles |
|---|---|---|---|
| `snappy` (0.22/0.8) | dots, pills, tabs, counters, nodes | ~0.06 s | ~0.25 s |
| `base` (0.4/0.86) | cards, panels (too fast for camera moves: reads as a cut) | ~0.1 s | ~0.4 s |
| `heavy` (0.5/1.0) | headlines, logo | ~0.13 s | ~0.6 s |
| `GLIDE` (0.9/1.0) | camera glides between UI targets | ~0.25 s | ~1 s |
| 1.3–1.6 s / 1.0 | big pushes, pull-backs, scrolls (pass as a per-key preset to `track` / `camAt`) | ~0.4 s | ~1.6 s |
Opacity driven by an overshooting spring must be clamped (`clamp01`).

## Shots
- `<Shot id="S3" pre={0.5} post={0.5}>` wraps a shot; inside it, time stays absolute.
  Use `pre` whenever the shot's first hit starts before its cut (hits lead the beat!) and `post` so an
  exit finishes after the cut. Never nest a `<Sequence>` inside a Shot for timing (Lottie excepted:
  wrap the Lottie in its own `<Sequence from>` with local frames).
- Layout per format: `const f = useFormat(); f.pick(wide, tall)`, sizes `× f.u`, `f.safe` rectangle.

## Vocabulary (components and how to do it)
| Move | How |
|---|---|
| Words rise through a mask | `<RiseText text at exitAt accentWords />` (`src/motion/text.tsx`) |
| Two-tone headline | two `RiseText` lines: `C.accent100` then `C.accent400` (on dark ground only) |
| Logo build | `<LogoLockup at wordAt size word direction pushFrom pushTo />` (any SVG in `public/`, set in `studio.config.json`); for a bespoke build, animate the logo's own paths |
| Liquid backdrop | `<LiquidBackdrop loopSec center drift radius blur />` behind everything, in `Stage` |
| Card tilt settle | `transform: cardTilt(hit("x","base"))`, `boxShadow: cardShadow(f.u)` (`src/motion/depth.ts`) |
| Grow from source | scale 0.85→1 with `hit(…, "base")`, opacity `clamp01(since(ref) * fps / 4)` (≤4 frames) |
| Camera push on a hold | wrap the shot in a div with `scale: 1 + 0.04 * span(from, to)` |
| A dot, checkbox or toggle fills | scale 0→1 `hit(…, "snappy")` + `tick` SFX on the same ref |
| Counter rolls | value = round(mix(a, b, hit(…, "base"))), tabular numbers |
| Chart draws | Recharts `isAnimationActive={false}` and `key={useCurrentFrame()}` on every chart (fresh mount per frame; otherwise axis labels flicker between render tabs); clip-path width = `span(a, b)` eased, or slice data by progress; port your app's charts into `src/kit/app/` |
| Hard cut | nothing; just the next `<Shot>` on a bar line |
| Push / whip | outgoing `translate` x → −110 % with `hit(cut,"base")`, incoming from +110 %; `whoosh` SFX peaking on the cut |

## Legibility on the backdrop
- Accent-coloured text never sits on the accent-coloured blob (it disappears). Over the blob use white text,
  or move the blob (`center`, `drift`) so text sits on the dark side. The critic caps readability at 6 otherwise.

## Lessons from real films
- **The liquid backdrop is a spice, not the ground.** Under every shot it reads as overdone; one moment per film
  (usually the hook), then let the dark ground and the UI carry the colour.
- **Design 9:16 from the app's real phone layout.** Squeezing a desktop dashboard into a tall frame produced
  tiny, cut-off cards for several critique rounds before the switch.
- **Slow camera moves need slow springs.** `base` on a big push reads as a jump cut; use GLIDE or 1.3–1.6 s.
- **Title exits:** a pure mask lift can leave glyph specks at the mask edge; lift as one line and fade over the
  second half of the move.
- **60 fps metrics:** the review's static-hold check flags slow pushes at 60 fps that pass at 30 fps (half the
  change per frame). Compare per-second, not per-frame.
- **Keep every round:** `review.py` keeps each round's MP4s and every round is a commit, so any reviewed
  version can be rebuilt and compared.

## Rendering checks while building
- `npx remotion still <slug>-9x16 out/x.png --frame=<n>` (draft fps 30: frame = seconds × 30).
- `tools/render.sh <slug> draft 9x16 --frames=120-300` to check one passage.
- Finals are 60 fps with `CameraMotionBlur` (180°, 10 samples) on the foreground only.

# Video studio: house rules

Remotion 4 project that makes motion videos for one product, set in `studio.config.json` (`appName`,
`appSlug`, `appUrl`, `appRepoPath`). Each video lives in `videos/<slug>/` and is made with
`/promo-video <slug>`, which runs the gated pipeline in `.claude/skills/promo-video/SKILL.md`.
If `studio.config.json` or `brand/*.md` still contain `{{…}}` placeholders or FILL markers, run `/promo-video setup` first.
Use the Remotion skills for API questions.

## Sources of truth (read before touching a video)
1. `brand/brand.md`: what the product is, which claims are allowed, tone, CTA.
2. `brand/frame.md`: colours, type, motion personality. `src/theme.ts` mirrors it; scenes never hard-code hex.
3. `brand/sound.md`: voice, music style, SFX palette, loudness.
4. Per video, in order: `brief.md` → `script.md` → `shotlist.md` → `timeline.json` (in beats) →
   `timeline.resolved.json` (generated) → `scenes/*.tsx`.
   Never edit `timeline.resolved.json`; edit `timeline.json` and a hook re-runs `tools/sync.mjs`.

## The app repo and secrets
- The app's code (`appRepoPath` in `studio.config.json`) is read-only reference material. Never edit it, never
  commit there. Read it to verify claims and to port UI components.
- Never read `.env*` anywhere. Tools load keys from `.env` themselves; never print them.

## Render contract
- Every frame is a pure function of the frame number. Animate only from `useCurrentFrame()` and `src/motion`.
  No CSS transitions/animations, tailwindcss-animate, framer-motion, setTimeout, requestAnimationFrame,
  `Date`, or `Math.random` (use `src/motion/random.ts`).
- Recharts: `isAnimationActive={false}`, reveal from the frame, and `key` every chart by `useCurrentFrame()`
  (Recharts keeps measured state per mount; across render tabs the axes flicker otherwise). Lottie only
  through `@remotion/lottie`.
- Time is in beats. Convert with `useTimeline()` helpers; never hard-code frame numbers (drafts are 30 fps,
  finals 60 fps) and never sum durations by hand.
- Visual hits lead the beat: start hit animations with `hitStart()` so they read on the beat.
- 2D transforms only (`translate`, `scale`, `rotate`). No `will-change`, `translate3d`, `translateZ`.
  The one exception is the UI-card tilt helper in `src/motion/depth.ts`.
- One layout per format via `useFormat().pick(wide, tall)`. Never crop one format into the other.
- Motion blur is for finals only, and wraps the foreground layer (never the backdrop or grain).

## Look (defaults; `brand/frame.md` may tighten them)
- One display face, one UI face, one accent family (all in `brand/frame.md`). Accent on the key word only.
- Banned: a lone centred title on a gradient; everything fading in; crossfades between shots; corner
  labels; frame borders; glow on UI; particle bursts; spins, glitches, light leaks; bounce on UI or type;
  dead holds.
- Enters: rise through a mask, grow from a source (scale 0.85→1, opacity in ≤4 frames), type-on, build
  (skeleton → content), card rise. Exits: lift through a mask, get covered, get pushed, collapse into the
  next shot, hard cut. A pure opacity fade is never an enter or exit (small sub-lines may fade).
- Type: sentence case; headline ≥84 px and must-read text ≥44 px on a 1080 px short side; readable at
  360 px wide. Scale the camera, not the font.
- 9:16: keep key content out of the top 14 %, bottom 20 % and right 12 % (platform buttons live there).
- Rhythm: frame 0 is never empty; hook readable by 2 s; something new every 2–4 s; no hold longer than one
  bar without motion (micro push 1.00→1.04); hard cuts on bar lines, inner events on beats or half-beats;
  end card ≤2 s and never static.
- Real UI only: `src/kit/app/` components ported from the app repo, or captured screens. Never invent UI.

## Gates (never skip, never self-approve)
Brief → script → shotlist + storyboard stills → animatic → build → critique (≥3 rounds, every score ≥8)
→ user phone check → finals. Stop and wait for the user's "approved" at: brief, script, storyboard,
animatic, drafts. Never render finals without the user's OK. Never spend API credits beyond the brief's cap.

## Review
- Judge rendered output only (`tools/review.py` on MP4s), never the code's intent.
- Read at most ~6 full-resolution images in the main thread; sheet review goes to the `frame-critic` agent.
- Log every critique round and every piece of user feedback in `videos/<slug>/review_log.md`.

## Commands
- Studio: `npm run dev` · Resolve timeline: `node tools/sync.mjs <slug>`
- Draft: `tools/render.sh <slug> draft` · Final: `tools/render.sh <slug> final`
- Python tools: `.venv/bin/python tools/<tool>.py <slug>` (beats, music_synth, sfx, vo, mix, review, finish)
- Unfilled placeholders: `npm run placeholders`

## Compact instructions
Keep: current slug, gate status, open critic issues, last scores, unaddressed user feedback.

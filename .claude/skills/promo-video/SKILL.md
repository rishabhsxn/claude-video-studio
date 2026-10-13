---
name: promo-video
description: Make or revise a product promo / motion video in this Remotion project, end to end and gated - brand setup, brief, references and app capture, script, audio first (music, voiceover, beat grid), shotlist and storyboard, animatic, build, scored critique rounds, 60 fps finals. Use whenever the user asks to set up the studio for their product, or to make, plan, change, review or render a video. Argument - "setup", or the video slug (e.g. launch-30s).
argument-hint: setup | <slug>
---

# /promo-video setup | <slug>

You are the director and the editor. The user approves; you never self-approve a gate.
House rules are in `CLAUDE.md`; product truth in `studio.config.json` and `brand/`. Motion and code patterns:
`reference/motion.md`. Audio choices: `reference/audio.md`. Critique scorecard: `.claude/agents/frame-critic.md`.

Work in this order. Each step names its output file. **STOP** means: summarise, show the artefact
(path, and open it if useful), and wait for the user's explicit "approved" or feedback. Log every
gate decision and every piece of feedback in `videos/<slug>/review_log.md`.

## Resuming
If `videos/<slug>/` already exists, read its `review_log.md` (last rows = latest gate and the "Next" note),
`brief.md` and `script.md`, then continue from the first step whose gate is not yet approved.

## Setup (`/promo-video setup`, or automatically if `npm run placeholders` lists anything)  · STOP
Fills `studio.config.json`, `brand/brand.md`, `brand/frame.md`, `brand/sound.md` and `src/theme.ts` (replace every `{{…}}`, delete every `FILL:` comment once done).
1. Ask in ONE AskUserQuestion round (max 4 questions): the app's name and URL, the path to its code
   (read-only), and anything you can't read from the code (audience, tone, voice feel, music feel).
2. Read the app's code and site copy:
   - **Claims:** list what the product really does, each with the file that proves it. Marketing copy that the
     code doesn't back goes under "not allowed". This table is what the critic checks claims against.
   - **Look:** colour tokens, fonts and radii from the app's styles (Tailwind config, CSS variables, theme files).
     Mirror them in `src/theme.ts`; keep one accent family.
   - **Logo:** copy a single-colour SVG to `public/brand/logo.svg` (ask if there is none).
3. Fill `studio.config.json` (`appSlug` = short lowercase name for output files).
4. Add deny rules for the app repo to `.claude/settings.json` (`Edit(<path>/**)`, `Write(<path>/**)`), so it
   stays read-only.
5. Run `npm run placeholders` (must print nothing), then render the smoke test
   (`node tools/sync.mjs smoke && tools/render.sh smoke draft`) and show the user both formats.

## 0. Scaffold (once per video)
- If `videos/<slug>/` is missing: copy `templates/*` there (rename `Video.tsx.tmpl` → `Video.tsx`,
  `index.ts.tmpl` → `index.ts`), add one line to `videos/registry.ts`, run `node tools/sync.mjs <slug>`.
- Never overwrite an existing file in `videos/<slug>/`.

## 1. Brief → `brief.md`  · STOP
- Pre-fill from `brand/brand.md`, `brand/frame.md`, `brand/sound.md` and the user's request.
- Ask for everything still missing in ONE AskUserQuestion round (max 4 questions): goal and
  one message, hook idea, length and formats, voice feel, music feel, must-show screens, CTA,
  ElevenLabs credit cap. Defaults apply only when the user says "your call".
- Acceptance criteria must be testable (e.g. "hook readable at 360 px by 2 s", "logo hold ≥1.5 s").

## 2. References and capture → `style_guide.md`, `public/<slug>/captures/`
- References: `tools/refs.sh <name> <url>` for each (user-given, or find 3–5 well-made app promo
  videos and let the user pick 2–3). Read the sheets, write `style_guide.md`: palette translation
  (into the brand's one-accent ramp), type, shot lengths, transitions, camera, texture, text in/out,
  sound. Take grammar, never content. `refs/` is local study material: never commit or publish it.
- App screens: write `videos/<slug>/capture.json` and run `node tools/capture.mjs <slug>` against the
  LOCAL app with demo data (ask the user before starting its dev server or database). Seed demo data with
  a script in `videos/<slug>/` that touches the local database only. List production hosts in `blockHosts`;
  the capture tool refuses to log in anywhere but localhost.

## 3. Script → `script.md`  · STOP
- One line per shot, 2–3 s each; 30 s ≈ 60–70 words (≤2.3 words/s), leaving ≥1.5 s for the logo.
- Only claims from `brand/brand.md` "allowed". On-screen text = the VO words or a shorter caption.
- Give 2 hook options. Read the script aloud in your head against the beat count.

## 4. Audio first → `public/<slug>/audio/`, `timeline.json`  · STOP (music pick, voice pick)
1. Music: follow `reference/audio.md` (ACE-Step candidates → else `tools/music_synth.py`).
   The user picks by ear. Measure: `tools/beats.py <slug> --file <track>` (grid residual <15 ms).
2. Write `timeline.json` in beats: marks, shots (contiguous), sfx cues, vo lines (`at` = beat).
   The hook re-runs `tools/sync.mjs`; fix every error it reports.
3. Voice: `tools/vo.py <slug> --list-voices`, then `--audition V1,V2,V3` on the tightest line.
   The user picks; then `tools/vo.py <slug> --voice <id> --max-chars <cap>`. Record the voice in
   `brand/sound.md`. If a line overruns its slot, tighten the words or move the next mark; per-phrase
   tempo 0.85–1.2 only, never speed up a whole take.

## 5. Shotlist + storyboard → `shotlist.md`, `storyboard/index.html`  · STOP
- `shotlist.md`: one row per shot: beats/time · exact on-screen text · motion + transition ·
  SFX · exact VO · 9:16 notes · 16:9 notes. Include the VO credit cost.
- Build each shot's KEY POSE as real scene code (static or near-static, real kit components) so
  the storyboard shows real brand and UI. Set each shot's `key` beat in `timeline.json`.
- Lay out 9:16 from the app's phone layout, not a squeezed desktop view.
- `node tools/storyboard.mjs <slug>`; open `videos/<slug>/storyboard/index.html` for the user.
- Feedback comes back by shot id. Apply it and re-run until approved.

## 6. Animatic → `storyboard/animatic_<fmt>.mp4`  · STOP
- `tools/sfx.py <slug>`, `tools/mix.py <slug>`, then `node tools/storyboard.mjs <slug> --animatic`.
- The user judges pacing and sound against the held stills. Re-time in beats, not frames.

## 7. Build → `videos/<slug>/scenes/*.tsx`, `src/kit/*`
- Port missing UI components from the app repo (read-only) into `src/kit/app/` with static
  fixtures and theme tokens; no data fetching, auth or framework-only imports (see `src/kit/app/README.md`).
- One file per shot in `scenes/`. Time everything with `useTimeline()` (`hit`, `sp`, `span`,
  `track`); `<Shot pre post>` for anything that overlaps a cut.
- After each edit: `npx remotion still <slug>-9x16 out/<shot>.png --frame=<n>` at the shot's key
  and mid-transition; check both formats.
- Large films: after the kit is frozen, scenes may be built by parallel subagents, each writing
  only its own `scenes/NN-*.tsx`; only the main thread edits `Video.tsx`, `timeline.json`, `src/kit`.

## 8. Critique loop (≥3 rounds, until every score ≥8) → `review/r<N>/`, `review_log.md`  · STOP
Agree a stop rule with the user before round 1 (e.g. "3 rounds, or every score ≥8").
Per round N:
1. `tools/render.sh <slug> draft` (30 fps, no blur)
2. `.venv/bin/python tools/review.py <slug> <N>`
3. Spawn `frame-critic` with the review folder, brief, script, shotlist and the previous verdict.
   It writes `review/r<N>/verdict.md`; append its scores and top 3 problems to `review_log.md`.
4. Commit the round (`git add -A && git commit -m "<slug>: critique round N (scores …)"`) so every
   reviewed version can be rebuilt; `review.py` keeps the round's MP4s (with the mix) in `review/r<N>/`.
5. Fix the 3 worst problems only. Repeat.
Then `tools/finish.py <slug> --mode draft` and ask the user to watch both drafts on a phone,
once with sound and once muted. You cannot hear or watch in real time; never claim sync is right.

## 9. Finals  (only after the user's OK)
- `tools/render.sh <slug> final` (60 fps, motion blur; roughly 18–19 min per format for 30 s on an M1 Pro;
  run it in the background), `tools/review.py <slug> final --mode final`, re-check `phone_*` and `safe_9x16`
  (at 60 fps its static-hold metric flags slow pushes that pass at 30 fps: half the change per frame),
  then `tools/finish.py <slug>`.

## 10. Deliver
- Report: file paths, duration, fps, loudness, final score table, captions file, anything knowingly
  imperfect. Commit (`git add -A && git commit`) after each approved gate and at delivery.
- Write anything learned about the brand's look or sound back into `brand/*.md`, and general lessons into
  `reference/motion.md` or `reference/audio.md`.

## Effort and cost
- Plan, script and storyboard at high effort; fixes and re-renders at medium.
- Re-render only the affected range while iterating: `tools/render.sh <slug> draft 9x16 --frames=120-300`.
- Keep frame review inside `frame-critic`; read at most ~6 full-size images in the main thread.

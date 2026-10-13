# How {{APP_NAME}} sounds

Update this file when a choice is approved, so the next video sounds the same.

## Voice
- **Provider and plan:** ElevenLabs, {{FREE_OR_PAID_PLAN}}. The free plan is non-commercial and ElevenLabs asks
  for attribution (`elevenlabs.io`) when free-plan audio is published; paid plans include a commercial licence.
  Record how you credit it: {{CREDIT_RULE}}
- **Voice:** {{VOICE_NAME}} (`{{VOICE_ID}}`), chosen {{DATE}} over {{OTHER_CANDIDATES}}.
  Settings: stability 0.45, similarity 0.8, style 0.15, speaker boost (starting point; adjust per voice).
- **Pace:** about {{WORDS_PER_SECOND}} words/s (measure on the first take; ~2.3 is typical). Budget 0.45 s for a
  sentence-final full stop and 0.3–0.9 s after a colon. Write lines to fit at that rate before generating.
- **Model:** `eleven_multilingual_v2` via `POST /v1/text-to-speech/{voice_id}/with-timestamps`.
- **Delivery:** {{DELIVERY}} <!-- e.g. conversational, unhurried but not slow --> One line per shot, 2–3 s each.
  Never speed up a whole take; per-phrase tempo 0.85–1.2 only.
- **Budget:** the brief sets a credit cap per run.

## Music
- **Style:** {{MUSIC_STYLE}} <!-- e.g. minimal modern electronic, warm plucks/mallets, soft kick, no vocals -->
- **Tempo:** {{BPM_RANGE}} (default 120: one beat = 30 frames at 60 fps).
- **Shape:** quiet intro under the hook, lift into the main section, the strongest hit on the logo.
- **Sources, in order:** ACE-Step 1.5 (local, MIT) candidates → code-synth score (`tools/music_synth.py`) → a
  track you supply and have the rights to. The user picks by ear from 2–3 candidates; Claude checks tempo,
  grid fit, loudness and clipping.
- **Chosen track:** _per video, recorded in `videos/<slug>/brief.md`._

## Sound effects (synthesised by `tools/sfx.py`, no samples)
| Type | Use | Timing |
|---|---|---|
| `tick` | a dot, checkbox or toggle fills | on the cue |
| `pop` | a word, pill or card appears | on the cue |
| `click` | a tap or button press | on the cue |
| `whoosh` | a whip, push or big morph | peaks on the cue |
| `riser` | a build into the logo | peaks on the cue |
| `thump` | the logo lands | on the cue |
Gains: primary 0.7–0.9, secondary 0.45–0.6, texture 0.3–0.4. At most 2 sounds on one frame. Sparse beats
busy: not every pop needs a sound.

## Mix
- Music side-chain ducked under the voice (about −9 dB while words are active).
- SFX sit about 3 dB under the music.
- Master: −14 LUFS integrated, ≤ −1 dBTP true peak (4× oversampled limiter), 48 kHz.

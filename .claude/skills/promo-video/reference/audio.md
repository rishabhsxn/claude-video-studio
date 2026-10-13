# Audio: music, voice, SFX, mix

Audio comes first: the measured beat grid is the film's clock. Claude cannot hear; the user picks
music and voice by ear, Claude checks tempo, grid fit, loudness and clipping.

## Music
1. **ACE-Step candidates (local, MIT licence):**
   `PYTORCH_MPS_HIGH_WATERMARK_RATIO=0.0 .cache/ACE-Step-1.5/.venv/bin/python tools/music_ace.py <slug> --n 3 --key "A minor"`
   - Caption defaults to a calm product-video style; pass `--caption` with the style from `brand/sound.md` to steer (genre, mood,
     instruments, "no vocals", where the lift is). BPM and length come from the timeline (+4 s tail).
   - Install once: clone https://github.com/ACE-Step/ACE-Step-1.5 into `.cache/ACE-Step-1.5` and follow its README
     (own venv, checkpoints ~9 GB). ~2 min per 20 s candidate on an M1 Pro (MLX backend). The watermark override lifts
     PyTorch's MPS memory cap; close heavy apps while it runs.
   - Present the candidates to the user (file paths; they listen). Then measure the pick:
     `.venv/bin/python tools/beats.py <slug> --file audio/candidates/ace_<seed>.flac --bpm <bpm>`
     (p90 grid residual must be < 15 ms; it sets `music.startBeat` to the first downbeat).
2. **Fallback: synthesised score** `tools/music_synth.py <slug>`, exact grid, sections from
   `timeline.music.sections` (intro · build · full · drop · break · outro) and `chords`.
3. A track the user supplies: same `beats.py` step. Pick the window whose strongest hit lands on the logo
   (`music.startBeat`).

## Voice (ElevenLabs)
- Licence: the free plan is non-commercial and ElevenLabs asks for attribution (`elevenlabs.io`) when free-plan
  audio is published; paid plans include a commercial licence. Record the plan and the credit rule in
  `brand/sound.md` and the brief.
- Key in `.env` (the user types it; never read or print `.env`).
- `tools/vo.py <slug> --list-voices` → choose 3 calm, warm candidates →
  `--audition A,B,C` on the tightest line → user picks → `--voice <id> --max-chars <cap from brief>`.
- Takes are placed so the **first word lands on the line's beat** (`lead` in vo.json).
- If a line is too long for its slot: rewrite shorter, or move the next mark. Never time-stretch a
  whole take; per-phrase 0.85–1.2 only.

## SFX
- Declare in `timeline.json` `sfx` with `what`; `tools/sfx.py` synthesises them. `whoosh`/`riser` peak
  on the cue. Sparse: ≤2 sounds per frame, not every pop needs a sound.

## Mix and master
- `tools/mix.py <slug>`: levels from `timeline.mix` (musicDb, voDb, sfxDb, duckDb), music ducked under
  words, −14 LUFS, ≤ −1 dBTP (4× oversampled limiter). Warns if the limiter works > 4 dB.
- Studio plays `public/<slug>/audio/mix.wav` automatically once it exists.

# Brief: <slug>

**Status:** draft · approved by user on <date>

| Field | Value |
|---|---|
| Goal and one message | <the single thing a viewer should remember> |
| Audience | <who, where they watch (Reels/Shorts/YouTube/site)> |
| Hook (first 2 s) | <option A> / <option B> |
| Length | <30.0 s ±1> = <N> beats at <BPM> BPM |
| Formats | 9:16 1080×1920 (Reels/Shorts) · 16:9 1920×1080 (YouTube/site) |
| Must show | <screens / moments> |
| Claims | only "allowed" claims from brand/brand.md |
| CTA | {{APP_URL}} (from studio.config.json) |
| Voice | <feel: calm, warm, …> · ElevenLabs plan: <free / paid> · credit cap: <chars> |
| Music | <feel> · source: ACE-Step candidates / synth / supplied |
| References | <names in refs/> (grammar only) |
| Deliverables | final/<appSlug>_<slug>_1080x1920.mp4, final/<appSlug>_<slug>_1920x1080.mp4, .srt, posters |

## Acceptance criteria (testable)
- Hook readable at 360 px wide by 2.0 s; frame 0 not empty.
- Every claim on screen or in VO is in brand.md "allowed".
- Something new every 2–4 s; no hold > 1 bar without motion.
- Key text outside the 9:16 platform zones (top 14 %, bottom 20 %, right 12 %).
- Logo + app URL hold ≥1.5 s, not static.
- −14 LUFS ±1, ≤ −1 dBTP; every critic score ≥8.

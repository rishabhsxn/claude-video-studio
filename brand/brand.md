# {{APP_NAME}}: product truth for videos

<!-- Fill with `/promo-video setup` (Claude reads your app's code and asks what it can't find), or by hand.
     Every {{…}} placeholder must be gone before the first video: `npm run placeholders` lists what's left. -->

Source: `{{APP_REPO_PATH}}` code and site copy, checked {{DATE}}. Re-check the code before relying on a claim
marked "not allowed"; the app may have shipped it since.

## What it is
- **{{APP_NAME}}** is {{ONE_SENTENCE_WHAT_IT_IS}} at **{{APP_URL}}**.
- **Audience:** {{WHO_IT_IS_FOR}}
- **One-line promise:** "{{PROMISE}}"
- **CTA:** "{{APP_URL}}" {{CTA_NOTES}} <!-- e.g. never mention price if the pricing page isn't live -->

## Claims allowed (verified in code)
Only these may appear on screen or in the voiceover. The critic caps the brand score at 4 for anything else.
| Claim | Where it lives in the app |
|---|---|
| {{CLAIM_1}} | `{{FILE_THAT_PROVES_IT}}` |
| {{CLAIM_2}} | `{{FILE_THAT_PROVES_IT}}` |
| {{CLAIM_3}} | `{{FILE_THAT_PROVES_IT}}` |

## Claims NOT allowed (marketing copy says it, code doesn't do it)
- {{CLAIM_THE_CODE_DOES_NOT_BACK}}
- Any price, "free", user counts, ratings or testimonials, unless the brief says otherwise and they are true.

## Tone of voice
- {{TONE}} <!-- e.g. calm, direct, a little warm; short sentences; second person -->
- Show, don't hype: numbers and real screens instead of adjectives.
- Avoid: "revolutionary", "game-changer", "unlock", "supercharge", "journey", "This isn't X, it's Y",
  rhetorical triple questions{{MORE_BANNED_WORDS}}.

## Must show (pick per video)
- {{CORE_ACTION}} <!-- the one thing users do most, e.g. "the one-tap check-in" -->
- {{PROOF_MOMENT}} <!-- a number going up, a chart drawing itself, a result appearing -->
- The logo lockup and "{{APP_URL}}".

## Assets
| File | What |
|---|---|
| `public/brand/logo.svg` | Single-colour logo (`studio.config.json` → `logo`). LogoLockup recolours it. |
| `public/<slug>/captures/` | Real app screens captured at 3× from the local app with demo data (per video) |
| {{MORE_ASSETS}} | |

# Your app's UI, ported for video

Put components from your app here so the video shows **real UI, not mockups**. `/promo-video` ports them in
step 7 (build), reading your app's code from `appRepoPath` (read-only).

## Rules for a ported component
- **Static data only.** Replace data fetching, auth, stores and routing with props or a `fixtures.ts` file that
  holds a demo account's data. No network, no `fetch`, no framework-only imports (`next/*`, router hooks).
- **Theme tokens only.** Colours, radii and fonts come from `src/theme.ts`; copy the app's exact values into it.
- **Animate from the frame.** No CSS transitions or animation libraries; drive any motion with `useTimeline()`
  from the scene (pass progress values in as props).
- **Charts:** Recharts with `isAnimationActive={false}` and `key={useCurrentFrame()}` on every chart.
- **Icons:** use the same icon set as the app (e.g. `lucide-react`) at the same sizes.
- **Check it against a capture:** render a still and compare it with `public/<slug>/captures/` side by side.

`ExampleCard.tsx` shows the shape: props in, theme tokens, nothing else.

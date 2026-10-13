#!/usr/bin/env bash
# Render a video's compositions (video only; audio is muxed by tools/finish.py).
#   tools/render.sh <slug> draft [9x16|16x9]   30 fps, no motion blur, fast       → renders/draft_<fmt>.mp4
#   tools/render.sh <slug> final [9x16|16x9]   60 fps, motion blur, PNG frames    → renders/final_<fmt>.mp4
# Extra arguments after the format are passed to `remotion render` (e.g. --frames=120-240).
set -euo pipefail
cd "$(dirname "$0")/.."

slug="${1:?usage: tools/render.sh <slug> draft|final [fmt] [remotion args]}"
mode="${2:?draft or final}"
fmts="${3:-}"
shift $(( $# >= 3 ? 3 : $# ))

node tools/sync.mjs "$slug" --quiet
if [[ -z "$fmts" ]]; then
  fmts=$(node -e "console.log(require('./videos/$slug/timeline.resolved.json').formats.join(' '))")
fi
mkdir -p "videos/$slug/renders"

for fmt in $fmts; do
  out="videos/$slug/renders/${mode}_${fmt}.mp4"
  start=$(date +%s)
  if [[ "$mode" == "draft" ]]; then
    npx remotion render "$slug-$fmt" "$out" --props='{"draft":true}' --muted \
      --codec=h264 --crf=22 --x264-preset=veryfast --jpeg-quality=88 --log=error "$@"
  else
    npx remotion render "$slug-$fmt" "$out" --props='{"draft":false}' --muted \
      --codec=h264 --crf=14 --x264-preset=slow --image-format=png \
      --pixel-format=yuv420p --color-space=bt709 --log=error "$@"
  fi
  echo "$out ($(( $(date +%s) - start ))s)"
done

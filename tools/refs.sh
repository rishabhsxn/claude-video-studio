#!/usr/bin/env bash
# Download a reference video and break it into study material: contact sheets, cut times, specs.
# LOCAL STUDY ONLY. Reference videos belong to their creators: use them to learn grammar (shot
# lengths, transitions, type motion), never copy content, and never commit or publish them.
# refs/ is git-ignored for that reason. Downloading may also be against a site's terms: your call.
#   tools/refs.sh <name> <url-or-file>
# Output in refs/: <name>.mp4, frames/<name>/sheet.jpg (2 fps), cuts.txt (scene cuts), probe.txt
set -euo pipefail
cd "$(dirname "$0")/.."
name="${1:?usage: tools/refs.sh <name> <url-or-file>}"
src="${2:?url or local file}"
mkdir -p refs "refs/frames/$name"
mp4="refs/$name.mp4"

if [[ -f "$src" ]]; then
  cp "$src" "$mp4"
elif [[ "$src" == *.mp4* ]]; then
  curl -sL "$src" -o "$mp4"
else
  yt-dlp -q -f "bv*[height<=1920][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b" --merge-output-format mp4 -o "$mp4" "$src"
fi

ffprobe -v error -show_entries stream=codec_type,width,height,r_frame_rate:format=duration -of compact "$mp4" > "refs/frames/$name/probe.txt"
ffmpeg -v error -y -i "$mp4" -vf "fps=2,scale=320:-2,tile=6x6" "refs/frames/$name/sheet_%02d.jpg"
ffmpeg -hide_banner -i "$mp4" -vf "select='gt(scene,0.3)',showinfo" -f null - 2>&1 \
  | grep -o "pts_time:[0-9.]*" | cut -d: -f2 > "refs/frames/$name/cuts.txt" || true
echo "$mp4: $(cat "refs/frames/$name/probe.txt" | tr '\n' ' ')"
echo "cuts: $(wc -l < "refs/frames/$name/cuts.txt" | tr -d ' ') · sheets: refs/frames/$name/sheet_*.jpg"

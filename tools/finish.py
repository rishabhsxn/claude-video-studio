"""
Deliverables: mux the final (or draft) renders with the mastered mix, write captions and posters,
and verify every file.

  finish.py <slug> [--mode final|draft]

For each format: videos/<slug>/final/<appSlug>_<slug>_<W>x<H>.mp4 (appSlug from studio.config.json) (video stream copied, AAC 320k 48 kHz,
+faststart), poster_<fmt>.png at the logo mark (or the last shot key), and one captions .srt from the
voiceover word timings. Prints an ffprobe + loudness check per file.
"""
from __future__ import annotations

import json
import subprocess
import sys

from audiolib import ROOT, audio_dir, load_resolved, lufs, read_audio, ref_to_beat, beat_to_sec, true_peak_db
from review import frame_at, probe

_app = json.loads((ROOT / "studio.config.json").read_text()).get("appSlug", "")
APP = "video" if not _app or _app.startswith("{{") else _app


def srt_time(s: float) -> str:
    ms = int(round(s * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    sec, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"


def captions(r: dict) -> list[tuple[float, float, str]]:
    """Group VO words into short caption chunks: ≤4 words, ≤1.6 s, break after punctuation."""
    chunks = []
    for line in r["vo"]:
        cur: list[dict] = []
        for w in line["words"]:
            cur.append(w)
            dur = cur[-1]["endSec"] - cur[0]["startSec"]
            if len(cur) >= 4 or dur > 1.6 or w["text"][-1] in ".,!?;:":
                chunks.append(cur)
                cur = []
        if cur:
            chunks.append(cur)
    return [(c[0]["startSec"], c[-1]["endSec"], " ".join(w["text"] for w in c)) for c in chunks]


def main(slug: str) -> None:
    mode = sys.argv[sys.argv.index("--mode") + 1] if "--mode" in sys.argv else "final"
    r = load_resolved(slug)
    mix = audio_dir(slug) / "mix.wav"
    if not mix.exists():
        sys.exit("no mix.wav: run tools/mix.py first")
    out = ROOT / "videos" / slug / "final"
    out.mkdir(parents=True, exist_ok=True)

    poster_t = beat_to_sec(r, ref_to_beat(r, "end-0.5")) if "end" in r["marks"] else r["durationSec"] - 0.5
    for fmt in r["formats"]:
        src = ROOT / "videos" / slug / "renders" / f"{mode}_{fmt}.mp4"
        if not src.exists():
            print(f"skip {fmt}: {src.relative_to(ROOT)} missing")
            continue
        info = probe(src)
        dst = out / f"{APP}_{slug}_{info['width']}x{info['height']}{'' if mode == 'final' else '_draft'}.mp4"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(src), "-i", str(mix), "-map", "0:v:0", "-map", "1:a:0",
             "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-ac", "2",
             "-t", f"{r['durationSec']:.4f}", "-movflags", "+faststart", str(dst)],
            check=True,
        )
        frame_at(dst, poster_t).save(out / f"poster_{fmt}.png")
        chk = probe(dst)
        a = read_audio(dst)
        size_mb = dst.stat().st_size / 1e6
        print(
            f"{dst.relative_to(ROOT)}: {chk['width']}x{chk['height']} @{chk['fps']:.0f} fps {chk['pix_fmt']}, "
            f"{chk['duration']:.2f}s, {size_mb:.1f} MB, {lufs(a):.1f} LUFS, {true_peak_db(a):.1f} dBTP"
        )
        if abs(chk["duration"] - r["durationSec"]) > 0.1:
            print("  warning: duration differs from the timeline")

    caps = captions(r)
    if caps:
        srt = "\n".join(f"{i}\n{srt_time(a)} --> {srt_time(b)}\n{text}\n" for i, (a, b, text) in enumerate(caps, 1))
        (out / f"{APP}_{slug}.srt").write_text(srt)
        print(f"captions: {len(caps)} cues → final/{APP}_{slug}.srt")
    (out / "deliverables.json").write_text(json.dumps({"mode": mode, "files": sorted(p.name for p in out.iterdir())}, indent=1) + "\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])

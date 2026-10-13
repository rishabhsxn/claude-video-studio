"""
Build the review kit for one critique round from the RENDERED MP4s (never from the code).

  review.py <slug> <round> [--mode draft|final] [--formats 9x16,16x9]

Writes videos/<slug>/review/r<round>/:
  contact_<fmt>.jpg     2 fps sheet with timestamps (pacing, variety, blank frames)
  phone_<fmt>.jpg       shot key moments at 360 px wide (legibility on a phone)
  fast_<fmt>_<k>.jpg    12 consecutive frames around the 2 fastest moments (pops, smears, glitches)
  safe_9x16.jpg         key moments with the platform-UI zones shaded (top 14 %, bottom 20 %, right 12 %)
  keys_<fmt>/<shot>.png full-resolution key frame per shot
  metrics.json          motion, static runs, event gaps, blank frames, per-cue sync, loudness
  <mode>_<fmt>.mp4      the reviewed render itself (with the mix muxed in), so every round's video is kept
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from audiolib import ROOT, audio_dir, load_resolved, lufs, read_audio, ref_to_beat, beat_to_sec, true_peak_db


def probe(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height,r_frame_rate,nb_frames,pix_fmt:format=duration", "-of", "json", str(path)],
        check=True, capture_output=True, text=True,
    ).stdout
    j = json.loads(out)
    s = j["streams"][0]
    num, den = map(int, s["r_frame_rate"].split("/"))
    return {"width": s["width"], "height": s["height"], "fps": num / den, "pix_fmt": s["pix_fmt"],
            "duration": float(j["format"]["duration"])}


def decode(path: Path, w: int, h: int, gray=False, fps: float | None = None) -> np.ndarray:
    vf = f"scale={w}:{h}:flags=area" + (f",fps={fps}" if fps else "")
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-vf", vf, "-f", "rawvideo", "-pix_fmt", "gray" if gray else "rgb24", "-"],
        check=True, capture_output=True,
    ).stdout
    c = 1 if gray else 3
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, c) if not gray else np.frombuffer(raw, np.uint8).reshape(-1, h, w)


def frame_at(path: Path, t: float, w: int | None = None) -> Image.Image:
    vf = ["-vf", f"scale={w}:-2:flags=lanczos"] if w else []
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", f"{max(0, t):.4f}", "-i", str(path), "-frames:v", "1", *vf, "-f", "image2pipe", "-vcodec", "png", "-"],
        check=True, capture_output=True,
    ).stdout
    from io import BytesIO

    return Image.open(BytesIO(raw)).convert("RGB")


def font(size: int):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def label(img: Image.Image, text: str) -> Image.Image:
    d = ImageDraw.Draw(img)
    f = font(max(12, img.width // 14))
    box = d.textbbox((0, 0), text, font=f)
    d.rectangle((0, 0, box[2] + 8, box[3] + 6), fill=(0, 0, 0))
    d.text((4, 2), text, fill=(255, 255, 255), font=f)
    return img


def grid(tiles: list[Image.Image], cols: int, gap: int = 4, bg=(40, 40, 46)) -> Image.Image:
    w, h = tiles[0].size
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w + (cols - 1) * gap, rows * h + (rows - 1) * gap), bg)
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * (w + gap), (i // cols) * (h + gap)))
    return sheet


def shade_unsafe(img: Image.Image) -> Image.Image:
    over = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    W, H = img.size
    red = (255, 40, 60, 90)
    d.rectangle((0, 0, W, int(H * 0.14)), fill=red)
    d.rectangle((0, int(H * 0.80), W, H), fill=red)
    d.rectangle((int(W * 0.88), int(H * 0.14), W, int(H * 0.80)), fill=red)
    return Image.alpha_composite(img.convert("RGBA"), over).convert("RGB")


def key_time(r: dict, shot: dict) -> float:
    if shot.get("key") is not None:
        return beat_to_sec(r, ref_to_beat(r, shot["key"]))
    return shot["fromSec"] + 0.7 * (shot["toSec"] - shot["fromSec"])


def motion_curves(path: Path, info: dict, w: int = 270, chunk: int = 60):
    """
    Two per-frame motion curves:
      whole  = mean |frame diff| (everything, incl. the drifting backdrop): holds and static runs
      detail = mean |diff of high-passed frames| (sharp foreground only; the blurry backdrop
               cancels out): visual events and cue sync
    Also returns per-frame luma std (blank-frame scan).
    """
    from scipy.ndimage import gaussian_filter

    h = int(round(w * info["height"] / info["width"] / 2) * 2)
    proc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", str(path), "-vf", f"scale={w}:{h}:flags=area", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
        stdout=subprocess.PIPE,
    )
    whole, detail, std = [0.0], [0.0], []
    prev = prev_d = None
    size = w * h
    while True:
        buf = proc.stdout.read(size * chunk)
        if not buf:
            break
        g = np.frombuffer(buf, np.uint8).reshape(-1, h, w).astype(np.float32)
        d = g - gaussian_filter(g, sigma=(0, 4, 4))
        std.extend(g.std(axis=(1, 2)).tolist())
        if prev is not None:
            g = np.concatenate([prev[None], g])
            d = np.concatenate([prev_d[None], d])
        whole.extend(np.abs(np.diff(g, axis=0)).mean(axis=(1, 2)).tolist())
        detail.extend(np.abs(np.diff(d, axis=0)).mean(axis=(1, 2)).tolist())
        prev, prev_d = g[-1], d[-1]
    proc.wait()
    n = len(std)
    return np.array(whole[:n]), np.array(detail[:n]), np.array(std)


def metrics_for(path: Path, r: dict, info: dict) -> dict:
    fps = info["fps"]
    whole, detail, std = motion_curves(path, info)
    t = np.arange(len(std)) / fps
    blank = [round(float(x), 3) for x in t[std < 4]]
    # static runs on the whole picture
    floor = 0.12
    run, longest, longest_at = 0, 0, 0.0
    for i, m in enumerate(whole):
        run = run + 1 if m < floor else 0
        if run > longest:
            longest, longest_at = run, t[i] - (run - 1) / fps
    # visual events: detail-motion peaks clearly above the noise floor
    base = float(np.percentile(detail, 30))
    thr = base + max(0.25, 3 * float(np.median(np.abs(detail - np.median(detail)))))
    peaks = [i for i in range(1, len(detail) - 1) if detail[i] >= thr and detail[i] >= detail[i - 1] and detail[i] >= detail[i + 1]]
    events: list[float] = []
    for i in peaks:
        if not events or t[i] - events[-1] > 0.25:
            events.append(float(t[i]))
    marks = sorted(set(events + [s["fromSec"] for s in r["shots"]] + [0.0, r["durationSec"]]))
    gaps = np.diff(marks) if len(marks) > 1 else np.array([0.0])
    gi = int(np.argmax(gaps))
    # Cue sync (approximate; confirm flagged cues on the fast strips). Find the detail-motion peak
    # nearest the cue, walk back to the local floor, and call the first frame at 50 % of that rise the
    # visual onset. Pass if the visual leads the sound by ≤200 ms or lags it by ≤60 ms.
    sync = []
    for c in r["sfx"]:
        entry = {"cue": c["what"] or c["type"], "type": c["type"], "sec": c["sec"]}
        if c["sec"] < 0.1:
            sync.append({**entry, "offsetMs": None, "ok": True, "note": "at film start; not measurable"})
            continue
        lo = int(max(1, (c["sec"] - 0.25) * fps))
        hi = int(min(len(detail) - 1, (c["sec"] + 0.25) * fps))
        pk = lo + int(np.argmax(detail[lo : hi + 1]))
        back = int(max(0, pk - 0.4 * fps))
        fl = back + int(np.argmin(detail[back : pk + 1]))
        rise = float(detail[pk] - detail[fl])
        if rise < 0.15:
            sync.append({**entry, "offsetMs": None, "ok": False, "note": "no clear visual event near this cue"})
            continue
        onset = fl + int(np.argmax(detail[fl : pk + 1] - detail[fl] >= 0.5 * rise))
        off = round((onset / fps - c["sec"]) * 1000)
        sync.append({**entry, "offsetMs": off, "ok": -200 <= off <= 60})
    bad = [s for s in sync if not s["ok"]]
    return {
        "file": str(path.relative_to(ROOT)),
        "probe": info,
        "fastest": [round(float(t[i]), 3) for i in np.argsort(whole)[::-1][:5]],
        "blankFrames": blank[:50],
        "longestStaticSec": round(longest / fps, 3),
        "longestStaticAt": round(float(longest_at), 3),
        "events": [round(e, 3) for e in events],
        "maxGapSec": round(float(gaps[gi]), 3),
        "maxGapAt": round(float(marks[gi]), 3),
        "cueSync": sync,
        "cueSyncFailures": len(bad),
        "_motion": np.maximum(whole, detail),
    }


def fast_moments(motion: np.ndarray, fps: float, k=2) -> list[int]:
    order = np.argsort(motion)[::-1]
    picked: list[int] = []
    for i in order:
        if all(abs(i - p) > fps * 0.6 for p in picked):
            picked.append(int(i))
        if len(picked) == k:
            break
    return picked


def main(slug: str, rnd: str) -> None:
    mode = sys.argv[sys.argv.index("--mode") + 1] if "--mode" in sys.argv else "draft"
    r = load_resolved(slug)
    fmts = sys.argv[sys.argv.index("--formats") + 1].split(",") if "--formats" in sys.argv else r["formats"]
    out = ROOT / "videos" / slug / "review" / f"r{rnd}"
    out.mkdir(parents=True, exist_ok=True)
    report = {"round": rnd, "mode": mode, "formats": {}}

    for fmt in fmts:
        path = ROOT / "videos" / slug / "renders" / f"{mode}_{fmt}.mp4"
        if not path.exists():
            print(f"missing {path.relative_to(ROOT)}; render it first")
            continue
        info = probe(path)
        # keep this round's video next to its review (renders/ is overwritten by the next render)
        mix_wav = audio_dir(slug) / "mix.wav"
        kept = out / f"{mode}_{fmt}.mp4"
        if mix_wav.exists():
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(path), "-i", str(mix_wav), "-map", "0:v", "-map", "1:a",
                            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(kept)], check=True)
        else:
            shutil.copy2(path, kept)
        tall = info["height"] > info["width"]
        m = metrics_for(path, r, info)
        motion = m.pop("_motion")
        report["formats"][fmt] = m

        # contact sheet at 2 fps
        tw = 180 if tall else 300
        th = int(round(tw * info["height"] / info["width"] / 2) * 2)
        frames = decode(path, tw, th, fps=2)
        tiles = [label(Image.fromarray(f), f"{i / 2:.1f}s") for i, f in enumerate(frames)]
        grid(tiles, 10 if tall else 6).save(out / f"contact_{fmt}.jpg", quality=85)

        # phone test + safe zones + full-res keys at each shot's key moment
        keys_dir = out / f"keys_{fmt}"
        keys_dir.mkdir(exist_ok=True)
        phone, safe = [], []
        for s in r["shots"]:
            kt = min(key_time(r, s), r["durationSec"] - 1 / info["fps"])
            full = frame_at(path, kt)
            full.save(keys_dir / f"{s['id']}.png")
            small = full.resize((360, int(360 * full.height / full.width)), Image.LANCZOS)
            phone.append(label(small.copy(), f"{s['id']} {kt:.2f}s"))
            if tall:
                safe.append(label(shade_unsafe(small), s["id"]))
        grid(phone, 6 if tall else 4).save(out / f"phone_{fmt}.jpg", quality=88)
        if tall:
            grid(safe, 6).save(out / "safe_9x16.jpg", quality=85)

        # 12 consecutive frames around the fastest moments
        for k, i in enumerate(fast_moments(motion, info["fps"])):
            t0 = max(0, i - 6) / info["fps"]
            strip = []
            for j in range(12):
                tt = t0 + j / info["fps"]
                # seek to the middle of the frame: an exact n/fps rounds onto the next frame and repeats it
                strip.append(label(frame_at(path, tt + 0.5 / info["fps"], w=tw), f"{tt:.3f}"))
            grid(strip, 6).save(out / f"fast_{fmt}_{k + 1}.jpg", quality=88)

    mix = audio_dir(slug) / "mix.wav"
    if mix.exists():
        x = read_audio(mix)
        report["audio"] = {"lufs": round(lufs(x), 2), "truePeakDb": round(true_peak_db(x), 2), "durationSec": round(len(x) / 48000, 3)}
    (out / "metrics.json").write_text(json.dumps(report, indent=1) + "\n")
    print(f"review kit: {out.relative_to(ROOT)}")
    for fmt, m in report["formats"].items():
        print(
            f"  {fmt}: {m['probe']['width']}x{m['probe']['height']}@{m['probe']['fps']:.0f} {m['probe']['duration']:.2f}s · "
            f"blank {len(m['blankFrames'])} · static max {m['longestStaticSec']}s · gap max {m['maxGapSec']}s@{m['maxGapAt']} · "
            f"cue sync failures {m['cueSyncFailures']}/{len(m['cueSync'])}"
        )
    if "audio" in report:
        a = report["audio"]
        print(f"  audio: {a['lufs']} LUFS, {a['truePeakDb']} dBTP")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])

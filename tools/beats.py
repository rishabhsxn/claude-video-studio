"""
Measure a music track's beat grid and make it the video's clock.

  beats.py <slug> --file audio/candidates/ace_1234.flac [--bpm 120] [--start-beat N] [--measure-only]

- Onset envelope + librosa beat tracker (BPM hint corrected for half/double time).
- A comb search finds the steady grid (tempo ±4 %, phase) that sits on the strongest onsets; grid beats
  within ±8 ms of an onset peak are snapped to it. Acceptance: p90 residual < 15 ms (else the track drifts).
- Downbeats: the bar phase with the most 20–150 Hz energy.
- Copies the track to public/<slug>/audio/music.wav (48 kHz), writes beats.json, sets
  timeline.json music.file and music.startBeat (first downbeat unless --start-beat), then re-syncs.
"""
from __future__ import annotations

import json
import sys

import librosa
import numpy as np

from audiolib import ROOT, SR, audio_dir, read_audio, resync, video_dir, write_wav


def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def main(slug: str) -> None:
    src = arg("--file")
    if not src:
        sys.exit(__doc__)
    path = (ROOT / "public" / slug / src) if not src.startswith("/") else ROOT / src
    if not path.exists():
        path = ROOT / src
    x = read_audio(path)
    mono = x.mean(axis=1)
    hint = float(arg("--bpm", 0)) or None

    hop = 256
    onset = librosa.onset.onset_strength(y=mono, sr=SR, hop_length=hop, aggregate=np.median)
    tempo, frames = librosa.beat.beat_track(onset_envelope=onset, sr=SR, hop_length=hop, start_bpm=hint or 120, units="frames")
    tempo = float(np.atleast_1d(tempo)[0])
    if hint:
        for f in (0.5, 2.0):
            if abs(tempo * f - hint) < abs(tempo - hint):
                tempo *= f
    if len(frames) < 8:
        sys.exit("too few beats tracked; is this track rhythmic?")

    # Comb search: the steady grid (period, phase) whose beats sit on the strongest onsets.
    # Searched around the tracker's tempo (or the hint) ±4 %, phase at hop resolution.
    env = onset / (onset.max() + 1e-9)
    fr = SR / hop
    dur = len(mono) / SR
    p_center = 60.0 / (hint or tempo)
    best = (-1.0, p_center, 0.0)
    for period in np.linspace(p_center * 0.96, p_center * 1.04, 161):
        phases = np.arange(0, period, 1 / fr)
        ks = np.arange(int(dur / period) + 1)
        t = phases[:, None] + ks[None, :] * period
        idx = np.clip(np.round(t * fr).astype(int), 0, len(env) - 1)
        score = (env[idx] * (t < dur)).sum(axis=1) / np.maximum(1, (t < dur).sum(axis=1))
        i = int(np.argmax(score))
        if score[i] > best[0]:
            best = (float(score[i]), float(period), float(phases[i]))
    _, period, t0 = best
    grid = t0 + period * np.arange(int((dur - t0) / period) + 1)
    # Residual: distance from each grid beat to the nearest onset peak within ±40 ms (if any);
    # snap beats within ±8 ms of a peak.
    peaks = librosa.util.peak_pick(env, pre_max=3, post_max=3, pre_avg=10, post_avg=10, delta=0.05, wait=8) / fr
    residuals, snapped = [], grid.copy()
    for i, g in enumerate(grid):
        if len(peaks) == 0:
            break
        j = int(np.argmin(np.abs(peaks - g)))
        d = peaks[j] - g
        if abs(d) <= 0.04:
            residuals.append(abs(d))
            if abs(d) <= 0.008:
                snapped[i] = peaks[j]
    resid_ms = 1000 * float(np.percentile(residuals, 90)) if residuals else float("nan")

    # Downbeats: bar phase (0..3) with the most low-frequency energy at its beats.
    S = np.abs(librosa.stft(mono, n_fft=2048, hop_length=hop))
    freqs = librosa.fft_frequencies(sr=SR, n_fft=2048)
    low = S[(freqs >= 20) & (freqs <= 150)].sum(axis=0)
    def low_at(t):
        return low[min(len(low) - 1, int(t * SR / hop))]
    phase = int(np.argmax([sum(low_at(t) for t in snapped[p::4]) for p in range(4)]))
    downbeats = snapped[phase::4]

    verdict = "OK" if resid_ms < 15 else "DRIFTS (>15 ms): pick another track or trim to a steady section"
    if "--measure-only" in sys.argv:
        print(f"{path.name}: {60.0 / period:.2f} BPM, first downbeat at beat {phase}, grid residual (p90) {resid_ms:.1f} ms → {verdict} (measure only)")
        return
    adir = audio_dir(slug)
    write_wav(adir / "music.wav", x)
    out = {
        "source": str(path.relative_to(ROOT)),
        "bpm": round(60.0 / period, 3),
        "beats": [round(float(t), 5) for t in snapped],
        "downbeats": [round(float(t), 5) for t in downbeats],
        "residualMs": round(resid_ms, 2),  # 90th percentile, ms
        "trackedBeats": len(frames),
    }
    (adir / "beats.json").write_text(json.dumps(out, indent=1) + "\n")

    tl_path = video_dir(slug) / "timeline.json"
    tl = json.loads(tl_path.read_text())
    tl.setdefault("music", {})
    tl["music"]["file"] = "audio/music.wav"
    tl["music"]["source"] = str(path.relative_to(ROOT))
    tl["music"]["startBeat"] = int(arg("--start-beat", phase))
    tl["bpm"] = out["bpm"]
    tl_path.write_text(json.dumps(tl, indent=2) + "\n")
    resync(slug)
    print(f"{path.name}: {out['bpm']} BPM, {len(snapped)} beats, first downbeat at beat {phase}, grid residual (p90) {resid_ms:.1f} ms → {verdict}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])

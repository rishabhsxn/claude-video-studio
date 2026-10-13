"""
Synthesise the sound-effects stem from the resolved timeline (no samples, no licences).

Each cue in timeline.resolved.json `sfx` becomes one sound. `whoosh` and `riser` build up and
PEAK on the cue; everything else starts on the cue.
Writes public/<slug>/audio/stems/sfx.wav.
Usage: .venv/bin/python tools/sfx.py <slug>
"""
from __future__ import annotations

import sys

import numpy as np
from scipy.signal import butter, sosfilt

from audiolib import SR, audio_dir, load_resolved, write_wav

rng = np.random.default_rng(11)


def _t(sec: float) -> np.ndarray:
    return np.arange(int(sec * SR)) / SR


def _band(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], btype="band", fs=SR, output="sos"), x)


def tick():
    t = _t(0.05)
    return (np.sin(2 * np.pi * 2300 * t) * 0.8 + _band(rng.standard_normal(len(t)), 3000, 9000) * 0.25) * np.exp(-t * 110)


def pop():
    t = _t(0.12)
    f = 520 + 520 * np.exp(-t * 45)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, t / 0.002) * np.exp(-t * 38)


def click():
    t = _t(0.04)
    return (_band(rng.standard_normal(len(t)), 2500, 7000) * 0.6 + np.sin(2 * np.pi * 3100 * t) * 0.5) * np.exp(-t * 160)


def thump():
    t = _t(0.5)
    f = 42 + 60 * np.exp(-t * 22)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.5)
    knock = _band(rng.standard_normal(len(t)), 150, 900) * np.exp(-t * 70) * 0.35
    return body + knock


def shutter():
    return np.concatenate([click(), np.zeros(int(0.03 * SR)), click() * 0.7])


def whoosh(build: float = 0.32, release: float = 0.22):
    """Swept band-passed noise that peaks at index `peak` (returned)."""
    t = _t(build + release)
    peak_i = int(build * SR)
    env = np.where(np.arange(len(t)) < peak_i, (np.arange(len(t)) / peak_i) ** 2.2, np.exp(-(np.arange(len(t)) - peak_i) / SR * 16))
    noise = rng.standard_normal(len(t))
    lo = _band(noise, 300, 1400)
    hi = _band(noise, 1800, 6500)
    sweep = np.clip(np.arange(len(t)) / peak_i, 0, 1)
    return (lo * (1 - sweep) + hi * sweep) * env * 1.4, peak_i


def riser(build: float = 1.8):
    t = _t(build + 0.06)
    peak_i = int(build * SR)
    ramp = np.clip(np.arange(len(t)) / peak_i, 0, 1)
    f = 180 + 900 * ramp**2
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.35
    noise = _band(rng.standard_normal(len(t)), 900, 8000) * 0.5
    env = ramp**2.5 * np.where(np.arange(len(t)) > peak_i, 0.0, 1.0)
    return (tone + noise) * env, peak_i


ONSET = {"tick": tick, "pop": pop, "click": click, "thump": thump, "shutter": shutter}
PEAKED = {"whoosh": whoosh, "riser": riser}


def main(slug: str) -> None:
    resolved = load_resolved(slug)
    n = int((resolved["durationSec"] + 2) * SR)
    out = np.zeros((n, 2), np.float32)
    for c in resolved["sfx"]:
        if c["type"] in PEAKED:
            sig, peak_i = PEAKED[c["type"]]()
            start = int(round(c["sec"] * SR)) - peak_i
        else:
            sig = ONSET[c["type"]]()
            start = int(round(c["sec"] * SR))
        sig = sig / max(1e-9, float(np.max(np.abs(sig)))) * c["gain"]
        a, b = max(0, start), min(n, start + len(sig))
        if b > a:
            out[a:b] += (sig[a - start : b - start])[:, None]
    write_wav(audio_dir(slug) / "stems" / "sfx.wav", out)
    print(f"sfx.wav: {len(resolved['sfx'])} cues")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])

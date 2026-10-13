"""
Mix and master: music (trimmed to the grid) + voiceover takes + SFX stem → public/<slug>/audio/mix.wav.

- Music is side-chain ducked under the voice (timeline `mix.duckDb`, default −9 dB).
- Levels from timeline `mix`: musicDb, voDb, sfxDb.
- Optional music automation from timeline `music.automation` (low-pass sweeps and gain rides in beats),
  to shape a steady track into the film's arc: muffled intro, open on the first cut, dip before the logo.
- Master: linear gain to −14 LUFS, then a 4x-oversampled lookahead limiter to ≤ −1 dBTP.
Writes mix.wav (48 kHz / 24-bit) and mix_report.json, then re-syncs so Studio plays it.
Usage: .venv/bin/python tools/mix.py <slug> [--target -14]
"""
from __future__ import annotations

import json
import sys

import numpy as np
from numba import njit
from scipy.ndimage import binary_closing

from audiolib import ROOT, SR, audio_dir, db, limit, load_resolved, lufs, read_audio, resync, true_peak_db, write_wav


@njit(cache=True)
def _follow(x: np.ndarray, a_up: float, a_down: float) -> np.ndarray:
    """Envelope follower with separate attack/release coefficients."""
    y = np.empty_like(x)
    cur = 0.0
    for i in range(x.shape[0]):
        coef = a_up if x[i] > cur else a_down
        cur = x[i] + (cur - x[i]) * coef
        y[i] = cur
    return y


@njit(cache=True)
def _svf_lowpass(x: np.ndarray, cutoff: np.ndarray, q: float = 0.707) -> np.ndarray:
    """Zero-delay-feedback state-variable low-pass with a per-sample cutoff (smooth sweeps, no clicks)."""
    y = np.empty_like(x)
    k = 1.0 / q
    for c in range(x.shape[1]):
        ic1 = 0.0
        ic2 = 0.0
        for i in range(x.shape[0]):
            g = np.tan(np.pi * min(cutoff[i], 0.45 * SR) / SR)
            a1 = 1.0 / (1.0 + g * (g + k))
            a2 = g * a1
            a3 = g * a2
            v3 = x[i, c] - ic2
            v1 = a1 * ic1 + a2 * v3
            v2 = ic2 + a2 * ic1 + a3 * v3
            ic1 = 2.0 * v1 - ic1
            ic2 = 2.0 * v2 - ic2
            y[i, c] = v2
    return y


def automation_curves(r: dict, n: int):
    """
    timeline.music.automation: [{"at": <beat ref>, "lowpassHz": 700, "gainDb": -3}, ...]
    Values are linearly interpolated between points (cutoff in log space); the first point holds before,
    the last holds after. Missing fields default to fully open / 0 dB.
    """
    from audiolib import beat_to_sec, ref_to_beat

    pts = (r.get("music") or {}).get("automation") or []
    t = np.arange(n) / SR
    if not pts:
        return None, np.ones(n)
    secs = np.array([beat_to_sec(r, ref_to_beat(r, p["at"])) for p in pts])
    order = np.argsort(secs)
    secs = secs[order]
    lp = np.log(np.array([pts[i].get("lowpassHz", 20000.0) for i in order]))
    gd = np.array([pts[i].get("gainDb", 0.0) for i in order])
    cutoff = np.exp(np.interp(t, secs, lp))
    gain = 10 ** (np.interp(t, secs, gd) / 20)
    return (cutoff if np.any(cutoff < 19000) else None), gain


def smooth_env(mask: np.ndarray, attack_ms: float, release_ms: float) -> np.ndarray:
    return _follow(mask.astype(np.float64), np.exp(-1.0 / (SR * attack_ms / 1000)), np.exp(-1.0 / (SR * release_ms / 1000)))


def main(slug: str, target: float = -14.0) -> None:
    r = load_resolved(slug)
    lvl = {"musicDb": -2.0, "voDb": 0.0, "sfxDb": -5.0, "duckDb": -9.0, **(r.get("mix") or {})}
    n = int(round(r["durationSec"] * SR))
    adir = audio_dir(slug)
    bus = np.zeros((n, 2), np.float32)

    # Music
    music_file = (r.get("music") or {}).get("file", "audio/music.wav")
    mpath = ROOT / "public" / slug / music_file
    music = np.zeros((n, 2), np.float32)
    if mpath.exists():
        m = read_audio(mpath)
        trim = int(round(r["musicTrimSec"] * SR))
        m = m[trim : trim + n]
        music[: len(m)] = m
        cutoff, gain = automation_curves(r, n)
        if cutoff is not None:
            music = _svf_lowpass(music.astype(np.float64), cutoff).astype(np.float32)
        music *= gain[:, None].astype(np.float32)
    else:
        print(f"warning: no music at {mpath.relative_to(ROOT)}")

    # Voice
    vo = np.zeros((n, 2), np.float32)
    active = np.zeros(n, bool)
    for line in r["vo"]:
        if not line.get("file"):
            continue
        take = read_audio(ROOT / "public" / slug / line["file"])
        start = int(round(line["fileStartSec"] * SR))
        a, b = max(0, start), min(n, start + len(take))
        if b > a:
            vo[a:b] += take[a - start : b - start]
        for w in line["words"]:
            active[max(0, int(w["startSec"] * SR)) : min(n, int(w["endSec"] * SR))] = True
    # bridge gaps under 0.25 s between words so the duck doesn't pump inside a phrase
    if active.any():
        active = binary_closing(active, structure=np.ones(int(0.25 * SR), bool))
    duck = 1.0 - (1.0 - db(lvl["duckDb"])) * smooth_env(active, attack_ms=60, release_ms=280)

    # SFX
    sfx = np.zeros((n, 2), np.float32)
    spath = adir / "stems" / "sfx.wav"
    if spath.exists():
        s = read_audio(spath)[:n]
        sfx[: len(s)] = s

    bus = music * db(lvl["musicDb"]) * duck[:, None] + vo * db(lvl["voDb"]) + sfx * db(lvl["sfxDb"])
    # gentle fade on the very end so the cut to black is clean
    fade = int(0.35 * SR)
    bus[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5

    # Master: gain to target, limit, re-check, iterate twice.
    gr_max = 0.0
    out = bus
    for _ in range(3):
        cur = lufs(out)
        out = out * db(target - cur)
        out, gr = limit(out, ceiling_db=-1.2)
        gr_max = max(gr_max, gr)
        if abs(lufs(out) - target) < 0.2:
            break
    final_lufs, final_tp = lufs(out), true_peak_db(out)
    write_wav(adir / "mix.wav", out)
    report = {
        "lufs": round(final_lufs, 2),
        "truePeakDb": round(final_tp, 2),
        "limiterMaxGrDb": round(gr_max, 2),
        "levels": lvl,
        "durationSec": r["durationSec"],
    }
    (adir / "mix_report.json").write_text(json.dumps(report, indent=1) + "\n")
    resync(slug)
    print(f"mix.wav: {final_lufs:.2f} LUFS, {final_tp:.2f} dBTP, limiter max GR {gr_max:.1f} dB")
    if gr_max > 4:
        print("warning: limiter working hard (>4 dB); lower musicDb or sfx gains")
    if final_tp > -1.0 or abs(final_lufs - target) > 0.5:
        print("warning: master missed the target")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    tgt = float(sys.argv[sys.argv.index("--target") + 1]) if "--target" in sys.argv else -14.0
    main(sys.argv[1], tgt)

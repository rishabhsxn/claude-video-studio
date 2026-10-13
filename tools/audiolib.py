"""Shared helpers for the audio tools: paths, the resolved timeline, WAV I/O, loudness, limiting."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import numpy as np
from numba import njit
import soundfile as sf
from scipy.signal import resample_poly

ROOT = Path(__file__).resolve().parent.parent
SR = 48000


def video_dir(slug: str) -> Path:
    return ROOT / "videos" / slug


def audio_dir(slug: str) -> Path:
    d = ROOT / "public" / slug / "audio"
    d.mkdir(parents=True, exist_ok=True)
    return d


def resync(slug: str) -> None:
    """Re-resolve the timeline (picks up new beats.json / vo.json / mix.wav)."""
    subprocess.run(["node", str(ROOT / "tools" / "sync.mjs"), slug, "--quiet"], check=True)


def load_resolved(slug: str) -> dict:
    p = video_dir(slug) / "timeline.resolved.json"
    if not p.exists():
        resync(slug)
    return json.loads(p.read_text())


def load_timeline(slug: str) -> dict:
    return json.loads((video_dir(slug) / "timeline.json").read_text())


def ref_to_beat(resolved: dict, ref) -> float:
    """Same beat-reference syntax as tools/sync.mjs: number, "mark", "mark+1.5"."""
    if isinstance(ref, (int, float)):
        return float(ref)
    m = re.fullmatch(r"\s*([A-Za-z_]\w*)\s*([+-]\s*[\d.]+)?\s*", str(ref))
    if not m or m.group(1) not in resolved["marks"]:
        raise ValueError(f'unknown beat reference "{ref}"')
    return resolved["marks"][m.group(1)]["beat"] + (float(m.group(2).replace(" ", "")) if m.group(2) else 0.0)


def beat_to_sec(resolved: dict, beat: float) -> float:
    g = resolved["grid"]
    last = len(g) - 1
    if beat <= 0:
        return g[0] + beat * resolved["beatSec"]
    if beat >= last:
        return g[last] + (beat - last) * resolved["beatSec"]
    lo = int(np.floor(beat))
    return g[lo] + (g[lo + 1] - g[lo]) * (beat - lo)


def read_audio(path: Path) -> np.ndarray:
    """Read any audio file as float32 stereo at 48 kHz (mp3 via ffmpeg)."""
    if path.suffix.lower() in (".wav", ".flac"):
        x, sr = sf.read(str(path), dtype="float32", always_2d=True)
    else:
        raw = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
            check=True, capture_output=True,
        ).stdout
        x, sr = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy(), SR
    if x.shape[1] == 1:
        x = np.repeat(x, 2, axis=1)
    if sr != SR:
        x = resample_poly(x, SR, sr, axis=0).astype(np.float32)
    return x[:, :2]


def write_wav(path: Path, x: np.ndarray, subtype: str = "PCM_24") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), np.asarray(x, dtype=np.float32), SR, subtype=subtype)


def db(x: float) -> float:
    return 10 ** (x / 20)


def true_peak_db(x: np.ndarray) -> float:
    """True peak estimate via 4x oversampling (dBTP)."""
    up = resample_poly(x, 4, 1, axis=0)
    peak = float(np.max(np.abs(up))) if up.size else 0.0
    return 20 * np.log10(max(peak, 1e-9))


def lufs(x: np.ndarray) -> float:
    import pyloudnorm as pyln

    return float(pyln.Meter(SR).integrated_loudness(x))


@njit(cache=True)
def _release(gmin: np.ndarray, rel: float) -> np.ndarray:
    g = np.empty_like(gmin)
    cur = 1.0
    for i in range(gmin.shape[0]):
        target = gmin[i]
        cur = target if target < cur else target + (cur - target) * rel
        g[i] = cur
    return g


def limit(x: np.ndarray, ceiling_db: float = -1.2, lookahead_ms: float = 1.5, release_ms: float = 80.0):
    """
    Lookahead peak limiter run at 4x oversampling so inter-sample peaks are caught.
    Returns (limited signal, max gain reduction in dB).
    """
    ceiling = db(ceiling_db)
    up = resample_poly(x, 4, 1, axis=0)
    sr = SR * 4
    peak = np.max(np.abs(up), axis=1)
    need = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
    la = max(1, int(sr * lookahead_ms / 1000))
    # Lookahead: the gain must already be down when the peak arrives.
    padded = np.concatenate([need, np.ones(la)])
    from numpy.lib.stride_tricks import sliding_window_view

    gmin = sliding_window_view(padded, la + 1).min(axis=1)[: len(need)]
    # Release smoothing (instant attack, exponential release).
    g = _release(gmin, np.exp(-1.0 / (sr * release_ms / 1000)))
    out = up * g[:, None]
    out = resample_poly(out, 1, 4, axis=0).astype(np.float32)
    gr = -20 * np.log10(max(float(g.min()), 1e-9))
    return out, gr

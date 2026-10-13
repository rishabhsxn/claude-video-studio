"""
Synthesise a music bed from the timeline, exactly on the beat grid (the fallback music source).

Reads `music` in videos/<slug>/timeline.json:
  "sections": [{"at": "open", "kind": "intro"}, {"at": "logo", "kind": "drop"}]
      kinds: intro · build · full · drop · break · outro
  "chords": ["Am7", "Fmaj7", "C", "G"]   one per bar, cycled
  "accents": ["logo"]                     crash + big kick (default: a mark named "logo")
  "seed": 7                               variation seed

Writes public/<slug>/audio/music.wav, stems/drums.wav and beats.json (exact grid), then re-syncs.
Usage: .venv/bin/python tools/music_synth.py <slug>
"""
from __future__ import annotations

import json
import re
import sys

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

from audiolib import SR, audio_dir, beat_to_sec, load_resolved, load_timeline, ref_to_beat, resync, write_wav

SECTION_PARTS = {
    "intro": {"kick": 0, "clap": 0, "hat": 0.6, "bass": 0, "mallet": 1, "pad": 0.7},
    "build": {"kick": 0.7, "clap": 0, "hat": 1, "bass": 0, "mallet": 1, "pad": 0.8},
    "full": {"kick": 1, "clap": 1, "hat": 1, "bass": 1, "mallet": 1, "pad": 1},
    "drop": {"kick": 1, "clap": 1, "hat": 1, "bass": 1, "mallet": 1.25, "pad": 1},
    "break": {"kick": 0, "clap": 0, "hat": 0, "bass": 0, "mallet": 0.7, "pad": 1},
    "outro": {"kick": 0, "clap": 0, "hat": 0.4, "bass": 0, "mallet": 0.9, "pad": 0.9},
}

QUALITIES = {
    "": [0, 4, 7], "m": [0, 3, 7], "7": [0, 4, 7, 10], "m7": [0, 3, 7, 10], "maj7": [0, 4, 7, 11],
    "sus2": [0, 2, 7], "sus4": [0, 5, 7], "add9": [0, 4, 7, 14], "m9": [0, 3, 7, 10, 14], "maj9": [0, 4, 7, 11, 14],
}
NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def chord_notes(name: str) -> tuple[int, list[int]]:
    m = re.fullmatch(r"([A-G])([#b]?)(.*)", name)
    if not m or m.group(3) not in QUALITIES:
        raise ValueError(f"unknown chord {name}")
    root = NOTE[m.group(1)] + {"#": 1, "b": -1, "": 0}[m.group(2)]
    return root, QUALITIES[m.group(3)]


def hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def env_exp(n: int, rate: float, attack: float = 0.002) -> np.ndarray:
    t = np.arange(n) / SR
    return np.minimum(1.0, t / attack) * np.exp(-t * rate)


def add(buf: np.ndarray, start_sec: float, sig: np.ndarray, pan: float = 0.0, gain: float = 1.0) -> None:
    i = int(round(start_sec * SR))
    if i >= len(buf) or i + len(sig) <= 0:
        return
    s = sig[max(0, -i):]
    i = max(0, i)
    s = s[: len(buf) - i]
    left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i : i + len(s), 0] += s * gain * left * np.sqrt(2)
    buf[i : i + len(s), 1] += s * gain * right * np.sqrt(2)


def bandpass(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def highpass(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def lowpass(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def main(slug: str) -> None:
    resolved = load_resolved(slug)
    music = load_timeline(slug).get("music") or {}
    rng = np.random.default_rng(music.get("seed", 7))
    beat = resolved["beatSec"]
    bpb = resolved["beatsPerBar"]
    tail_beats = music.get("tailBeats", 4)
    total_beats = resolved["lengthBeats"] + tail_beats
    n = int((total_beats * beat + 1.5) * SR)
    drums = np.zeros((n, 2), np.float32)
    keys = np.zeros((n, 2), np.float32)
    pads = np.zeros((n, 2), np.float32)
    sends = np.zeros((n, 2), np.float32)

    sections = sorted(
        [(ref_to_beat(resolved, s["at"]), s["kind"]) for s in music.get("sections", [{"at": 0, "kind": "full"}])]
    )
    for _, kind in sections:
        if kind not in SECTION_PARTS:
            raise ValueError(f"section kind {kind} not in {list(SECTION_PARTS)}")

    def parts_at(b: float) -> dict:
        cur = SECTION_PARTS["full"]
        for at, kind in sections:
            if b >= at - 1e-6:
                cur = SECTION_PARTS[kind]
        return cur

    accents = [ref_to_beat(resolved, a) for a in music.get("accents", ["logo"] if "logo" in resolved["marks"] else [])]
    chords = [chord_notes(c) for c in music.get("chords", ["Am7", "Fmaj7", "C", "G"])]
    t_of = lambda b: beat_to_sec(resolved, b)  # noqa: E731

    # --- instruments -------------------------------------------------------
    def kick(big=False):
        m = int(0.45 * SR)
        t = np.arange(m) / SR
        f = 46 + (90 if big else 75) * np.exp(-t * 30)
        body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (5.5 if big else 8))
        click = highpass(rng.standard_normal(m) * np.exp(-t * 900), 2500) * 0.25
        return (body + click) * (1.15 if big else 1.0)

    def clap():
        m = int(0.25 * SR)
        x = np.zeros(m)
        for k, d in enumerate((0, 0.011, 0.022)):
            i = int(d * SR)
            burst = rng.standard_normal(m - i) * np.exp(-np.arange(m - i) / SR * (60 if k < 2 else 22))
            x[i:] += burst
        return bandpass(x, 1100, 4200) * 0.7

    def hat(open_=False):
        m = int((0.18 if open_ else 0.06) * SR)
        return highpass(rng.standard_normal(m), 7500, 3) * env_exp(m, 14 if open_ else 70, 0.001)

    def bass(f):
        m = int(beat * 0.45 * SR)
        t = np.arange(m) / SR
        saw = 2 * ((t * f) % 1.0) - 1
        x = np.sin(2 * np.pi * f * t) + 0.35 * lowpass(saw, 400)
        return x * env_exp(m, 7, 0.004)

    def mallet(f, bright=1.0):
        m = int(0.9 * SR)
        t = np.arange(m) / SR
        index = 2.2 * bright * np.exp(-t * 9)
        x = np.sin(2 * np.pi * f * t + index * np.sin(2 * np.pi * 3.5 * f * t))
        return x * env_exp(m, 4.5, 0.003)

    def pad_note(f, dur):
        m = int(dur * SR)
        t = np.arange(m) / SR
        x = sum(2 * ((t * f * d) % 1.0) - 1 for d in (0.996, 1.0, 1.004)) / 3
        att = np.minimum(1.0, t / 0.35)
        rel = np.minimum(1.0, (dur - t) / 0.25).clip(0, 1)
        return lowpass(x, 1100) * att * rel

    def crash():
        m = int(2.4 * SR)
        return highpass(rng.standard_normal(m), 3800, 2) * env_exp(m, 1.6, 0.001)

    # --- arrangement ---------------------------------------------------------
    sidechain = np.ones(n, np.float32)
    arp = [0, 2, 1, 3, 2, 1, 3, 2]
    bars = int(np.ceil(total_beats / bpb))
    for bar in range(bars):
        root, quality = chords[bar % len(chords)]
        bar_beat = bar * bpb
        p_bar = parts_at(bar_beat)
        if p_bar["pad"]:
            dur = t_of(bar_beat + bpb) - t_of(bar_beat) + 0.05
            for k, iv in enumerate(quality[:4]):
                add(pads, t_of(bar_beat), pad_note(hz(48 + root + iv), dur), pan=(k - 1.5) * 0.3, gain=0.09 * p_bar["pad"])
        for step in range(bpb * 2):  # eighth notes
            b = bar_beat + step / 2
            if b >= total_beats:
                break
            p = parts_at(b)
            ts = t_of(b)
            on_beat = step % 2 == 0
            beat_in_bar = step // 2
            if on_beat and p["kick"]:
                big = any(abs(b - a) < 1e-6 for a in accents)
                add(drums, ts, kick(big), gain=0.9 * p["kick"])
                k_env = 1 - 0.55 * np.exp(-np.arange(int(0.35 * SR)) / SR * 9)
                i = int(ts * SR)
                sidechain[i : i + len(k_env)] = np.minimum(sidechain[i : i + len(k_env)], k_env[: max(0, n - i)])
            if on_beat and beat_in_bar in (1, 3) and p["clap"]:
                add(drums, ts, clap(), pan=0.05, gain=0.32 * p["clap"])
            if p["hat"] and not on_beat:
                add(drums, ts, hat(open_=beat_in_bar == 3), pan=0.25, gain=0.11 * p["hat"])
            if p["hat"] and on_beat and p["kick"] == 0:
                add(drums, ts + beat / 4, hat(), pan=-0.25, gain=0.06 * p["hat"])
            if p["bass"] and not on_beat:
                add(keys, ts, bass(hz(36 + root)), gain=0.32 * p["bass"])
            if p["mallet"]:
                iv = quality[arp[step % len(arp)] % len(quality)]
                octave = 72 if step % 4 else 60
                sig = mallet(hz(octave + root + iv), bright=p["mallet"])
                pan = -0.35 if step % 2 else 0.35
                add(keys, ts, sig, pan=pan, gain=0.13 * p["mallet"])
                add(sends, ts, sig, pan=-pan, gain=0.05 * p["mallet"])
    for a in accents:
        add(drums, t_of(a), crash(), pan=0.1, gain=0.22)

    # --- bus processing --------------------------------------------------------
    pads *= sidechain[:, None]
    keys_ducked = keys * (0.5 + 0.5 * sidechain[:, None])
    delay = int(beat * 0.75 * SR)
    echo = np.zeros_like(sends)
    echo[delay:] += sends[:-delay] * 0.6
    echo[2 * delay :] += sends[: -2 * delay] * 0.3
    ir_len = int(1.4 * SR)
    ir = rng.standard_normal((ir_len, 2)) * np.exp(-np.arange(ir_len) / SR * 3.2)[:, None]
    ir = lowpass(ir.T, 5000).T * 0.02
    verb = np.stack([fftconvolve(keys[:, c] + pads[:, c], ir[:, c])[:n] for c in range(2)], axis=1)
    mix = drums + keys_ducked + pads + echo + verb * 0.5
    mix = np.tanh(mix * 1.1) / 1.1
    mix *= 10 ** (-3 / 20) / max(1e-9, float(np.max(np.abs(mix))))

    out = audio_dir(slug)
    write_wav(out / "music.wav", mix)
    write_wav(out / "stems" / "drums.wav", drums)
    grid = [round(t_of(b), 6) for b in range(int(total_beats) + 1)]
    beats = {
        "source": "synth",
        "bpm": resolved["bpm"],
        "beats": grid,
        "downbeats": grid[::bpb],
        "residualMs": 0.0,
    }
    (out / "beats.json").write_text(json.dumps(beats, indent=1) + "\n")
    resync(slug)
    print(f"music.wav: {len(mix) / SR:.2f}s, {len(sections)} section(s), chords {music.get('chords', 'default')}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])

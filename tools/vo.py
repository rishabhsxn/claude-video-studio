"""
ElevenLabs voiceover with word timings, one take per timeline `vo` line.

  vo.py <slug> --list-voices                 list voices on the account (name, id, labels)
  vo.py <slug> --audition V1,V2,V3 [--line L2] one line on several voices → audio/vo/audition/
  vo.py <slug> --voice <id> [--only L1,L3]   generate takes → audio/vo/<id>.mp3 + vo.json
Options: --model eleven_multilingual_v2 · --stability 0.45 --similarity 0.8 --style 0.15 · --max-chars N

Uses POST /v1/text-to-speech/{voice}/with-timestamps; character alignment is grouped into words.
The key is read from ELEVENLABS_API_KEY or the project .env and is never printed.
Credit guard: refuses to send more than --max-chars characters in one run (default 1500).
"""
from __future__ import annotations

import base64
import json
import os
import sys
import urllib.error
import urllib.request

from audiolib import ROOT, audio_dir, load_resolved, read_audio, resync, SR

API = "https://api.elevenlabs.io/v1"


def api_key() -> str:
    key = os.environ.get("ELEVENLABS_API_KEY", "")
    env = ROOT / ".env"
    if not key and env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("ELEVENLABS_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not key or key == "replace-me":
        sys.exit("ELEVENLABS_API_KEY missing or still the placeholder: put your key in .env at the repo root")
    if not key.startswith("sk_"):
        sys.exit("ELEVENLABS_API_KEY doesn't start with 'sk_': that looks like the key's ID, not the secret key. "
                 "Create a new key (the secret is shown once) and paste that into .env")
    return key


def call(path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers={"xi-api-key": api_key(), "Content-Type": "application/json", "Accept": "application/json"},
        method="POST" if body is not None else "GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:400]
        sys.exit(f"ElevenLabs {e.code} on {path}: {detail}")


def words_from_alignment(al: dict) -> list[dict]:
    chars, starts, ends = al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]
    words, cur = [], None
    for ch, s, e in zip(chars, starts, ends):
        if ch.isspace():
            if cur:
                words.append(cur)
            cur = None
            continue
        if cur is None:
            cur = {"text": ch, "start": s, "end": e}
        else:
            cur["text"] += ch
            cur["end"] = e
    if cur:
        words.append(cur)
    return [{"text": w["text"], "start": round(w["start"], 4), "end": round(w["end"], 4)} for w in words]


def tts(text: str, voice: str, opts: dict) -> tuple[bytes, list[dict]]:
    body = {
        "text": text,
        "model_id": opts["model"],
        "voice_settings": {
            "stability": opts["stability"],
            "similarity_boost": opts["similarity"],
            "style": opts["style"],
            "use_speaker_boost": True,
        },
    }
    res = call(f"/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_128", body)
    align = res.get("normalized_alignment") or res.get("alignment")
    return base64.b64decode(res["audio_base64"]), words_from_alignment(align)


def arg(name: str, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def main(slug: str) -> None:
    opts = {
        "model": arg("--model", "eleven_multilingual_v2"),
        "stability": float(arg("--stability", 0.45)),
        "similarity": float(arg("--similarity", 0.8)),
        "style": float(arg("--style", 0.15)),
    }
    max_chars = int(arg("--max-chars", 1500))

    if "--list-voices" in sys.argv:
        for v in call("/voices")["voices"]:
            labels = ", ".join(f"{k}:{val}" for k, val in (v.get("labels") or {}).items())
            print(f"{v['voice_id']}  {v['name']:<22} {labels}")
        return

    r = load_resolved(slug)
    lines = {l["id"]: l for l in r["vo"]}
    out = audio_dir(slug) / "vo"
    out.mkdir(parents=True, exist_ok=True)

    if "--audition" in sys.argv:
        voices = arg("--audition").split(",")
        line_id = arg("--line") or min(lines, key=lambda k: len(lines[k]["text"]))
        text = lines[line_id]["text"]
        if len(text) * len(voices) > max_chars:
            sys.exit(f"would send {len(text) * len(voices)} chars > --max-chars {max_chars}")
        (out / "audition").mkdir(exist_ok=True)
        for v in voices:
            audio, words = tts(text, v, opts)
            path = out / "audition" / f"{line_id}_{v}.mp3"
            path.write_bytes(audio)
            dur = len(read_audio(path)) / SR
            span = words[-1]["end"] - words[0]["start"] if words else 0
            print(f"{v}: {path.relative_to(ROOT)}  {dur:.2f}s file, {span:.2f}s speech, {len(words) / max(span, 1e-3):.2f} words/s")
        return

    voice = arg("--voice")
    if not voice:
        sys.exit("pass --voice <voice_id> (choose one with --audition first)")
    only = set(arg("--only").split(",")) if arg("--only") else None
    todo = [l for l in r["vo"] if not only or l["id"] in only]
    chars = sum(len(l["text"]) for l in todo)
    if chars > max_chars:
        sys.exit(f"would send {chars} chars > --max-chars {max_chars}")

    vo_json = audio_dir(slug) / "vo.json"
    data = json.loads(vo_json.read_text()) if vo_json.exists() else {"lines": []}
    by_id = {l["id"]: l for l in data["lines"]}
    for l in todo:
        audio, words = tts(l["text"], voice, opts)
        path = out / f"{l['id']}.mp3"
        path.write_bytes(audio)
        dur = len(read_audio(path)) / SR
        by_id[l["id"]] = {
            "id": l["id"],
            "text": l["text"],
            "file": f"audio/vo/{l['id']}.mp3",
            "duration": round(dur, 4),
            "lead": words[0]["start"] if words else 0.0,
            "words": words,
        }
        print(f"{l['id']}: {dur:.2f}s  “{l['text']}”")
    data = {"voice": voice, "settings": opts, "lines": [by_id[k] for k in sorted(by_id)]}
    vo_json.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
    resync(slug)
    print(f"sent {chars} characters")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])

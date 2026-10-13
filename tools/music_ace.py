"""
Generate instrumental music candidates locally with ACE-Step 1.5 (MIT), for the user to pick by ear.

Runs in ACE-Step's own environment (not .venv):
  .cache/ACE-Step-1.5/.venv/bin/python tools/music_ace.py <slug> [--n 3] [--duration S] [--bpm B]
      [--key "A minor"] [--caption "..."] [--seed 1234] [--steps 8]

Defaults come from the timeline (bpm, length + 4 s tail) and brand/sound.md's style.
Writes public/<slug>/audio/candidates/ace_<seed>.flac and candidates.json. First run downloads the
model checkpoints (several GB, can take ~40 min). Then measure a pick with tools/beats.py.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ACE = ROOT / ".cache" / "ACE-Step-1.5"

DEFAULT_CAPTION = (
    "minimal modern electronic instrumental for a calm product video, warm plucked synths and soft "
    "mallets, gentle four-on-the-floor kick, light hi-hats, round sub bass, clean and optimistic, "
    "no vocals, steady groove, a clear lift halfway, polished mix"
)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--n", type=int, default=3)
    ap.add_argument("--duration", type=float)
    ap.add_argument("--bpm", type=int)
    ap.add_argument("--key", default="")
    ap.add_argument("--caption", default=DEFAULT_CAPTION)
    ap.add_argument("--seed", type=int, default=1234)
    ap.add_argument("--steps", type=int, default=8)
    a = ap.parse_args()

    resolved = json.loads((ROOT / "videos" / a.slug / "timeline.resolved.json").read_text())
    bpm = a.bpm or round(resolved["bpm"])
    duration = a.duration or max(10.0, resolved["durationSec"] + 4.0)
    out = ROOT / "public" / a.slug / "audio" / "candidates"
    out.mkdir(parents=True, exist_ok=True)

    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
    os.chdir(ACE)
    sys.path.insert(0, str(ACE))
    from acestep.handler import AceStepHandler
    from acestep.inference import GenerationConfig, GenerationParams, generate_music

    t0 = time.time()
    dit = AceStepHandler()
    status, ok = dit.initialize_service(project_root=str(ACE), config_path="acestep-v15-turbo", device="auto")
    if not ok:
        sys.exit(f"ACE-Step init failed: {status}")
    print(f"model ready in {time.time() - t0:.0f}s on {dit.device}")

    results = []
    for i in range(a.n):
        seed = a.seed + i
        params = GenerationParams(
            task_type="text2music",
            caption=a.caption,
            lyrics="[Instrumental]",
            instrumental=True,
            bpm=bpm,
            keyscale=a.key,
            timesignature="4",
            duration=duration,
            inference_steps=a.steps,
            shift=3.0,
            seed=seed,
            thinking=False,
            use_cot_metas=False,
            use_cot_caption=False,
            use_cot_language=False,
        )
        config = GenerationConfig(batch_size=1, use_random_seed=False, seeds=[seed], audio_format="flac")
        t1 = time.time()
        res = generate_music(dit, None, params, config, save_dir=str(out))
        if not res.success:
            print(f"seed {seed}: failed: {res.error}")
            continue
        src = Path(res.audios[0]["path"])
        dst = out / f"ace_{seed}.flac"
        src.replace(dst)
        results.append({"file": str(dst.relative_to(ROOT / "public" / a.slug)), "seed": seed, "bpm": bpm, "key": a.key,
                        "duration": duration, "caption": a.caption, "seconds": round(time.time() - t1, 1)})
        print(f"seed {seed}: {dst.relative_to(ROOT)} ({time.time() - t1:.0f}s)")
    (out / "candidates.json").write_text(json.dumps(results, indent=1) + "\n")


if __name__ == "__main__":
    main()

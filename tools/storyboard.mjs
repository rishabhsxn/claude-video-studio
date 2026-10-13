#!/usr/bin/env node
// Storyboard and animatic for review before any animation polish.
//
//   node tools/storyboard.mjs <slug>              one still per shot (its `key` beat, or one per entry of
//                                                `keys`) in every format
//                                                → videos/<slug>/storyboard/index.html
//   node tools/storyboard.mjs <slug> --animatic   also cut the stills to the shot timing with the current
//                                                mix → storyboard/animatic_<fmt>.mp4
//
// Stills come from the real scene code (draft props), so the storyboard shows actual brand and UI.

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sync } from "./sync.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2];
if (!slug) {
  console.error("usage: node tools/storyboard.mjs <slug> [--animatic]");
  process.exit(1);
}
const { resolved: r } = sync(slug, { quiet: true });
const outDir = path.join(ROOT, "videos", slug, "storyboard");
fs.mkdirSync(outDir, { recursive: true });

const beatToSec = (b) => {
  const g = r.grid;
  const last = g.length - 1;
  if (b <= 0) return g[0] + b * r.beatSec;
  if (b >= last) return g[last] + (b - last) * r.beatSec;
  const lo = Math.floor(b);
  return g[lo] + (g[lo + 1] - g[lo]) * (b - lo);
};
const refToBeat = (ref) => {
  if (typeof ref === "number") return ref;
  const m = /^([A-Za-z_]\w*)\s*([+-]\s*[\d.]+)?$/.exec(String(ref).trim());
  return r.marks[m[1]].beat + (m[2] ? Number(m[2].replace(/\s/g, "")) : 0);
};
const keySec = (s) => (s.key !== undefined ? beatToSec(refToBeat(s.key)) : s.fromSec + 0.7 * (s.toSec - s.fromSec));
/** Stills of a shot: [{ name, sec }]; `keys` gives several (named S5a, S5b, …), else the one `key`. */
const stills = (s) =>
  Array.isArray(s.keys) && s.keys.length
    ? s.keys.map((k, i) => ({ name: `${s.id}${"abcdefgh"[i]}`, sec: beatToSec(refToBeat(k)) }))
    : [{ name: s.id, sec: keySec(s) }];

console.log("Bundling…");
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts"), publicDir: path.join(ROOT, "public") });
const inputProps = { draft: true };

for (const fmt of r.formats) {
  const composition = await selectComposition({ serveUrl, id: `${slug}-${fmt}`, inputProps });
  let n = 0;
  for (const s of r.shots) {
    for (const k of stills(s)) {
      const frame = Math.min(composition.durationInFrames - 1, Math.round(k.sec * composition.fps));
      await renderStill({ composition, serveUrl, output: path.join(outDir, `${k.name}_${fmt}.png`), frame, inputProps, imageFormat: "png" });
      n++;
    }
  }
  console.log(`  ${fmt}: ${n} stills`);
}

// ---- review page --------------------------------------------------------------
const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const inShot = (sec, s) => sec >= s.fromSec - 1e-6 && sec < s.toSec - 1e-6;
const rows = r.shots
  .map((s) => {
    const vo = r.vo.filter((l) => inShot(l.sec, s)).map((l) => `<b>${esc(l.id)}</b> “${esc(l.text)}”`).join("<br>");
    const sfx = r.sfx.filter((c) => inShot(c.sec, s)).map((c) => `${esc(c.type)} @${c.sec.toFixed(2)}s`).join(", ");
    const imgs = stills(s)
      .flatMap((k) => r.formats.map((f) => `<figure class="f${f}"><img src="${k.name}_${f}.png" alt="${k.name} ${f}"><figcaption>${k.name} · ${f} · ${k.sec.toFixed(2)} s</figcaption></figure>`))
      .join("");
    return `<section><header><span class="id">${esc(s.id)}</span><span class="time">beats ${s.fromBeat}–${s.toBeat} · ${s.fromSec.toFixed(2)}–${s.toSec.toFixed(2)} s (${(s.toSec - s.fromSec).toFixed(2)} s)</span></header>
<p class="what">${esc(s.what)}</p>${s.text ? `<p class="onscreen">On screen: ${esc(s.text)}</p>` : ""}
${vo ? `<p class="vo">${vo}</p>` : ""}${sfx ? `<p class="sfx">SFX: ${sfx}</p>` : ""}<div class="imgs">${imgs}</div></section>`;
  })
  .join("\n");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(slug)} storyboard</title><style>
:root{--bg:#0E1011;--card:#212529;--text:#fff;--muted:#ADB5BD;--accent:#9980E6}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 -apple-system,Roboto,sans-serif;padding:24px 16px}
h1{font-size:22px;margin:0 0 4px}.meta{color:var(--muted);margin:0 0 24px}
section{background:var(--card);border-radius:12px;padding:16px;margin:0 0 20px}
header{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}.id{font-weight:700;color:var(--accent);font-size:18px}.time{color:var(--muted)}
.what{margin:6px 0}.vo{margin:6px 0;color:#D0C4F3}.sfx,.onscreen{margin:6px 0;color:var(--muted);font-size:13px}
.imgs{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-top:10px}
figure{margin:0}figure img{display:block;border-radius:6px;max-width:100%}.f9x16 img{height:420px}.f16x9 img{height:236px}
figcaption{color:var(--muted);font-size:12px;margin-top:4px}
@media (max-width:700px){.f9x16 img{height:auto;width:100%}.f16x9 img{height:auto;width:100%}}
</style></head><body><h1>${esc(slug)}: storyboard</h1>
<p class="meta">${r.lengthBeats} beats @ ${r.bpm} BPM = ${r.durationSec} s · ${r.shots.length} shots · give feedback by shot id (e.g. “S3: bigger chart, less text”)</p>
${rows}</body></html>`;
fs.writeFileSync(path.join(outDir, "index.html"), html);
console.log(`storyboard: videos/${slug}/storyboard/index.html`);

// ---- animatic -------------------------------------------------------------------
if (process.argv.includes("--animatic")) {
  const mix = path.join(ROOT, "public", slug, "audio", "mix.wav");
  for (const fmt of r.formats) {
    // each still holds until the next still (or the shot's end); a shot's first still covers its start
    const seq = r.shots.flatMap((s) => {
      const ks = stills(s);
      return ks.map((k, i) => ({ name: k.name, from: i === 0 ? s.fromSec : k.sec, to: i + 1 < ks.length ? ks[i + 1].sec : s.toSec }));
    });
    const list = seq.map((q) => `file '${q.name}_${fmt}.png'\nduration ${(q.to - q.from).toFixed(4)}`).join("\n");
    const listFile = path.join(outDir, `animatic_${fmt}.txt`);
    fs.writeFileSync(listFile, `${list}\nfile '${seq.at(-1).name}_${fmt}.png'\n`);
    const out = path.join(outDir, `animatic_${fmt}.mp4`);
    const audio = fs.existsSync(mix) ? ["-i", mix, "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k"] : [];
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listFile, ...audio,
      "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "20", "-t", String(r.durationSec), out], { cwd: outDir });
    console.log(`animatic: videos/${slug}/storyboard/animatic_${fmt}.mp4${audio.length ? "" : " (no mix yet: silent)"}`);
  }
}

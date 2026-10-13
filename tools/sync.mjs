#!/usr/bin/env node
// Resolve videos/<slug>/timeline.json (authored in beats) into timeline.resolved.json (seconds).
// Remotion scenes and every Python audio tool read only the resolved file, so picture, music,
// SFX and voice share one clock.
//
// Beat references: a number (beats), a mark name, or "mark+1.5" / "mark-0.5".
// Beat → seconds uses the measured grid in public/<slug>/audio/beats.json when it exists,
// otherwise a straight grid from `bpm`.
//
// Usage: node tools/sync.mjs <slug> [--quiet]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SFX_TYPES = ["tick", "pop", "click", "whoosh", "riser", "thump", "shutter"];

const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null);

export function sync(slug, { quiet = false } = {}) {
  const dir = path.join(ROOT, "videos", slug);
  const tl = readJson(path.join(dir, "timeline.json"));
  if (!tl) throw new Error(`videos/${slug}/timeline.json not found`);
  const measured = readJson(path.join(ROOT, "public", slug, "audio", "beats.json"));
  const voTakes = readJson(path.join(ROOT, "public", slug, "audio", "vo.json"));
  const errors = [];
  const warnings = [];

  const bpm = measured?.bpm ?? tl.bpm;
  if (!bpm) errors.push("timeline needs `bpm`");
  const beatSec = 60 / bpm;
  const lengthBeats = tl.lengthBeats;
  const marks = tl.marks ?? {};

  // --- beat → seconds -----------------------------------------------------
  const startBeat = tl.music?.startBeat ?? 0; // which measured beat of the music is video beat 0
  let grid = null;
  let musicTrimSec = 0;
  if (measured?.beats?.length) {
    grid = measured.beats;
    if (startBeat >= grid.length) errors.push(`music.startBeat ${startBeat} beyond measured beats`);
    musicTrimSec = grid[startBeat] ?? 0;
  }
  const beatToSec = (b) => {
    if (!grid) return b * beatSec;
    const i = b + startBeat;
    const last = grid.length - 1;
    if (i <= 0) return grid[0] + i * beatSec - musicTrimSec;
    if (i >= last) return grid[last] + (i - last) * beatSec - musicTrimSec;
    const lo = Math.floor(i);
    return grid[lo] + (grid[lo + 1] - grid[lo]) * (i - lo) - musicTrimSec;
  };

  // --- references -----------------------------------------------------------
  const ref = (r, where) => {
    if (typeof r === "number") return r;
    const m = /^([A-Za-z_]\w*)\s*([+-]\s*[\d.]+)?$/.exec(String(r).trim());
    if (!m || !(m[1] in marks)) {
      errors.push(`${where}: unknown beat reference "${r}" (marks: ${Object.keys(marks).join(", ")})`);
      return 0;
    }
    return marks[m[1]] + (m[2] ? Number(m[2].replace(/\s/g, "")) : 0);
  };

  const round = (x) => Math.round(x * 10000) / 10000;
  const resolvedMarks = Object.fromEntries(
    Object.entries(marks).map(([k, b]) => [k, { beat: b, sec: round(beatToSec(b)) }]),
  );

  // --- shots ----------------------------------------------------------------
  const shots = (tl.shots ?? []).map((s, i) => {
    const fromBeat = ref(s.from, `shots[${i}].from`);
    const toBeat = ref(s.to, `shots[${i}].to`);
    if (toBeat <= fromBeat) errors.push(`shot ${s.id}: ends before it starts`);
    return { ...s, fromBeat, toBeat, fromSec: round(beatToSec(fromBeat)), toSec: round(beatToSec(toBeat)) };
  });
  shots.forEach((s, i) => {
    const next = shots[i + 1];
    if (next && Math.abs(next.fromBeat - s.toBeat) > 1e-6) {
      errors.push(`shots ${s.id}→${next.id}: gap or overlap (${s.toBeat} vs ${next.fromBeat} beats)`);
    }
    if (s.toSec - s.fromSec > 4.01) warnings.push(`shot ${s.id} lasts ${(s.toSec - s.fromSec).toFixed(2)} s (>4 s: needs internal events)`);
  });
  if (shots.length && shots[0].fromBeat !== 0) errors.push("first shot must start at beat 0");
  if (shots.length && Math.abs(shots.at(-1).toBeat - lengthBeats) > 1e-6) {
    errors.push(`last shot ends at beat ${shots.at(-1).toBeat}, lengthBeats is ${lengthBeats}`);
  }

  // --- sound effects ----------------------------------------------------------
  const sfx = [];
  (tl.sfx ?? []).forEach((c, i) => {
    if (!SFX_TYPES.includes(c.type)) errors.push(`sfx[${i}]: type "${c.type}" not in ${SFX_TYPES.join("/")}`);
    const at = ref(c.at, `sfx[${i}].at`);
    const until = c.until !== undefined ? ref(c.until, `sfx[${i}].until`) : at;
    const every = c.every ?? 0;
    for (let b = at; b <= until + 1e-9; b += every || Infinity) {
      sfx.push({ type: c.type, beat: round(b), sec: round(beatToSec(b)), gain: c.gain ?? 0.6, what: c.what ?? "" });
      if (!every) break;
    }
  });
  sfx.sort((a, b) => a.sec - b.sec);
  for (let i = 2; i < sfx.length; i++) {
    if (sfx[i].sec - sfx[i - 2].sec < 1 / 60) warnings.push(`3+ sounds on one frame at ${sfx[i].sec}s`);
  }

  // --- voiceover -----------------------------------------------------------
  const takes = Object.fromEntries((voTakes?.lines ?? []).map((l) => [l.id, l]));
  const vo = (tl.vo ?? []).map((l, i) => {
    const beat = ref(l.at, `vo[${i}].at`);
    const sec = round(beatToSec(beat));
    const take = takes[l.id];
    // The take's first word (not the file start) lands on the beat.
    const fileStartSec = round(sec - (take?.lead ?? 0));
    const words = take?.words?.map((w) => ({ text: w.text, startSec: round(fileStartSec + w.start), endSec: round(fileStartSec + w.end) })) ?? [];
    const speechEndSec = words.length ? words.at(-1).endSec : null;
    return { id: l.id, text: l.text, beat, sec, fileStartSec, file: take?.file ?? null, durationSec: take?.duration ?? null, speechEndSec, words };
  });
  vo.forEach((l, i) => {
    const next = vo[i + 1];
    if (l.speechEndSec && next && l.speechEndSec > next.sec - 0.08) {
      errors.push(`vo ${l.id} (${l.durationSec.toFixed(2)} s) runs into ${next.id}; move ${next.id} later or tighten the line`);
    }
    if (l.speechEndSec && l.speechEndSec > beatToSec(lengthBeats) - 0.3) errors.push(`vo ${l.id} ends after the film (or within 0.3 s of the end)`);
    if (takes[l.id] && takes[l.id].text !== l.text) warnings.push(`vo ${l.id}: text changed since it was generated; re-run tools/vo.py`);
  });

  const durationSec = round(beatToSec(lengthBeats));
  const resolved = {
    "//": "GENERATED by tools/sync.mjs from timeline.json. Do not edit.",
    slug,
    bpm: round(bpm),
    beatSec: round(beatSec),
    beatsPerBar: tl.beatsPerBar ?? 4,
    lengthBeats,
    durationSec,
    measuredGrid: Boolean(grid),
    musicTrimSec: round(musicTrimSec),
    formats: tl.formats ?? ["9x16", "16x9"],
    grid: Array.from({ length: Math.floor(lengthBeats) + 1 }, (_, b) => round(beatToSec(b))),
    marks: resolvedMarks,
    shots,
    sfx,
    vo,
    music: tl.music ?? null,
    mix: tl.mix ?? {},
    // Studio preview plays the mastered mix when tools/mix.py has written it.
    mixFile: fs.existsSync(path.join(ROOT, "public", slug, "audio", "mix.wav")) ? `${slug}/audio/mix.wav` : null,
  };

  if (errors.length) {
    const msg = `timeline ${slug}: ${errors.length} error(s)\n- ` + errors.join("\n- ");
    const err = new Error(msg);
    err.warnings = warnings;
    throw err;
  }
  fs.writeFileSync(path.join(dir, "timeline.resolved.json"), JSON.stringify(resolved, null, 1) + "\n");

  if (!quiet) {
    const fmt = (s) => s.toFixed(2).padStart(6);
    console.log(`${slug}: ${lengthBeats} beats @ ${resolved.bpm} BPM = ${durationSec}s (${grid ? "measured grid" : "straight grid"})`);
    for (const s of shots) console.log(`  ${s.id.padEnd(4)} beats ${String(s.fromBeat).padStart(5)}–${String(s.toBeat).padEnd(5)} ${fmt(s.fromSec)}–${fmt(s.toSec)}s  ${s.what ?? ""}`);
    if (sfx.length) console.log(`  sfx: ${sfx.length} cues · vo: ${vo.length} lines${vo.some((l) => l.file) ? "" : " (not generated yet)"}`);
    for (const w of warnings) console.log(`  warning: ${w}`);
  }
  return { resolved, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const slug = process.argv[2];
  if (!slug) {
    console.error("usage: node tools/sync.mjs <slug> [--quiet]");
    process.exit(1);
  }
  try {
    sync(slug, { quiet: process.argv.includes("--quiet") });
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

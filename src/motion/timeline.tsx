import React, { createContext, useContext } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { springAt, springTimes, type SpringName, type SpringPreset } from "./spring";

// Mirrors the output of tools/sync.mjs (videos/<slug>/timeline.resolved.json).
export type ResolvedTimeline = {
  slug: string;
  bpm: number;
  beatSec: number;
  beatsPerBar: number;
  lengthBeats: number;
  durationSec: number;
  formats: ("9x16" | "16x9")[];
  grid: number[];
  marks: Record<string, { beat: number; sec: number }>;
  shots: { id: string; fromBeat: number; toBeat: number; fromSec: number; toSec: number; what?: string; key?: number | string }[];
  sfx: { type: string; beat: number; sec: number; gain: number; what: string }[];
  vo: { id: string; text: string; beat: number; sec: number; durationSec: number | null; words: { text: string; startSec: number; endSec: number }[] }[];
  mixFile?: string | null;
};

/** A beat reference: beats as a number, a mark name, or "mark+1.5" / "mark-0.5". */
export type BeatRef = number | string;

const TimelineContext = createContext<ResolvedTimeline | null>(null);

// A <Sequence> resets the frame to 0, but scenes time everything against the whole film.
// <Shot> (src/kit/Stage.tsx) provides its start frame here so time stays absolute.
export const ShotOffsetContext = createContext(0);

/** Absolute frame of the film, even inside a <Shot>. */
export function useFilmFrame() {
  return useCurrentFrame() + useContext(ShotOffsetContext);
}

export const TimelineProvider: React.FC<{ value: ResolvedTimeline; children: React.ReactNode }> = ({ value, children }) => (
  <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>
);

/** Seconds for a beat reference, using the resolved (possibly measured) grid. */
export function beatRefToSec(tl: ResolvedTimeline, r: BeatRef): number {
  let beat: number;
  if (typeof r === "number") beat = r;
  else {
    const m = /^([A-Za-z_]\w*)\s*([+-]\s*[\d.]+)?$/.exec(r.trim());
    if (!m || !tl.marks[m[1]]) throw new Error(`Unknown beat reference "${r}"`);
    beat = tl.marks[m[1]].beat + (m[2] ? Number(m[2].replace(/\s/g, "")) : 0);
  }
  const g = tl.grid;
  const last = g.length - 1;
  if (beat <= 0) return g[0] + beat * tl.beatSec;
  if (beat >= last) return g[last] + (beat - last) * tl.beatSec;
  const lo = Math.floor(beat);
  return g[lo] + (g[lo + 1] - g[lo]) * (beat - lo);
}

/** Minimum lead for visual hits, in seconds (3 frames at 60 fps). */
const MIN_LEAD = 0.05;

/**
 * Timing helpers for the current frame. Everything is in seconds so drafts (30 fps) and
 * finals (60 fps) animate identically.
 */
export function useTimeline() {
  const tl = useContext(TimelineContext);
  if (!tl) throw new Error("useTimeline() needs a <TimelineProvider>");
  const frame = useFilmFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const sec = (r: BeatRef) => beatRefToSec(tl, r);
  /** When a hit animation must start so it reads on the beat: max(3 frames, time to half travel). */
  const hitStart = (r: BeatRef, preset: SpringName | SpringPreset = "base") =>
    sec(r) - Math.max(MIN_LEAD, springTimes(preset).half);
  return {
    tl,
    fps,
    frame,
    /** current time in seconds */
    t,
    sec,
    frameOf: (r: BeatRef) => Math.round(sec(r) * fps),
    /** seconds since a beat reference (negative before it) */
    since: (r: BeatRef) => t - sec(r),
    /** spring progress starting exactly at a beat reference */
    sp: (r: BeatRef, preset: SpringName | SpringPreset = "base") => springAt(t - sec(r), preset),
    hitStart,
    /** spring progress that lands (reads) on the beat reference */
    hit: (r: BeatRef, preset: SpringName | SpringPreset = "base") => springAt(t - hitStart(r, preset), preset),
    /** 0..1 linear progress between two beat references, clamped */
    span: (a: BeatRef, b: BeatRef) => Math.min(1, Math.max(0, (t - sec(a)) / (sec(b) - sec(a)))),
    shot: (id: string) => {
      const s = tl.shots.find((x) => x.id === id);
      if (!s) throw new Error(`Unknown shot ${id}`);
      return { ...s, active: t >= s.fromSec && t < s.toSec, local: t - s.fromSec };
    },
  };
}

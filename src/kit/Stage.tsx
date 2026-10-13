import { Audio } from "@remotion/media";
import { CameraMotionBlur } from "@remotion/motion-blur";
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from "remotion";
import { ShotOffsetContext, TimelineProvider, useTimeline, type ResolvedTimeline } from "../motion/timeline";
import { C } from "../theme";
import { Grain } from "./Grain";

export type VideoProps = { draft: boolean };

/**
 * Wraps a video: timeline context, backdrop, foreground (motion-blurred in finals only),
 * film grain, and the mixed audio for Studio preview. Final renders are muted and the
 * mastered mix is muxed afterwards by tools/finish.py.
 */
export const Stage: React.FC<{
  timeline: ResolvedTimeline;
  draft: boolean;
  backdrop?: React.ReactNode;
  grain?: number;
  children: React.ReactNode;
}> = ({ timeline, draft, backdrop, grain = 0.07, children }) => (
  <TimelineProvider value={timeline}>
    <AbsoluteFill style={{ backgroundColor: C.ink }}>
      {backdrop}
      {draft ? (
        <AbsoluteFill>{children}</AbsoluteFill>
      ) : (
        <CameraMotionBlur shutterAngle={180} samples={10}>
          <AbsoluteFill>{children}</AbsoluteFill>
        </CameraMotionBlur>
      )}
      {grain > 0 ? <Grain opacity={grain} /> : null}
      {timeline.mixFile ? <Audio src={staticFile(timeline.mixFile)} /> : null}
    </AbsoluteFill>
  </TimelineProvider>
);

/**
 * One shot from the timeline. `pre`/`post` (beats) extend it for transitions that overlap a cut.
 * Inside a Shot, time with useTimeline() only; a nested <Sequence> would reset the clock again.
 */
export const Shot: React.FC<{ id: string; pre?: number; post?: number; children: React.ReactNode }> = ({
  id,
  pre = 0,
  post = 0,
  children,
}) => {
  const { tl, sec } = useTimeline();
  const { fps } = useVideoConfig();
  const shot = tl.shots.find((s) => s.id === id);
  if (!shot) throw new Error(`Unknown shot ${id}`);
  const from = Math.round(sec(shot.fromBeat - pre) * fps);
  const to = Math.round(sec(shot.toBeat + post) * fps);
  return (
    <Sequence from={from} durationInFrames={Math.max(1, to - from)} name={`${id} ${shot.what ?? ""}`} layout="absolute-fill">
      <ShotOffsetContext.Provider value={from}>{children}</ShotOffsetContext.Provider>
    </Sequence>
  );
};

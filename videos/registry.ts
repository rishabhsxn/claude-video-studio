// One line per video. Each videos/<slug>/index.ts exports { timeline, Component }.
// /promo-video <slug> adds a line here when it scaffolds a new video.
import type React from "react";
import type { VideoProps } from "../src/kit/Stage";
import type { ResolvedTimeline } from "../src/motion/timeline";
import * as smoke from "./smoke";

export const VIDEOS: { timeline: ResolvedTimeline; Component: React.FC<VideoProps> }[] = [smoke];

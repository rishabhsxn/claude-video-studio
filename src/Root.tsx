import "./index.css";
import { Composition, Folder, type CalculateMetadataFunction } from "remotion";
import { VIDEOS } from "../videos/registry";
import type { VideoProps } from "./kit/Stage";
import { FORMATS } from "./motion/format";

// Every video in videos/registry.ts gets one composition per format, e.g. "smoke-9x16".
// Drafts (default props) render at 30 fps without motion blur; finals pass {"draft": false}
// and render at 60 fps with blur. Scenes time everything in seconds, so both match.
export const RemotionRoot: React.FC = () => (
  <>
    {VIDEOS.map(({ timeline, Component }) => {
      const calculateMetadata: CalculateMetadataFunction<VideoProps> = ({ props }) => {
        const fps = props.draft ? 30 : 60;
        return { fps, durationInFrames: Math.round(timeline.durationSec * fps) };
      };
      return (
        <Folder name={timeline.slug} key={timeline.slug}>
          {timeline.formats.map((f) => (
            <Composition
              key={f}
              id={`${timeline.slug}-${f}`}
              component={Component}
              width={FORMATS[f].width}
              height={FORMATS[f].height}
              fps={30}
              durationInFrames={Math.round(timeline.durationSec * 30)}
              defaultProps={{ draft: true }}
              calculateMetadata={calculateMetadata}
            />
          ))}
        </Folder>
      );
    })}
  </>
);

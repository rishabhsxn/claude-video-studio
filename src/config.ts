// The product this studio makes videos for. Values come from studio.config.json at the repo root;
// `/promo-video setup` fills them. Until then, `filled()` returns a readable fallback for renders.
import raw from "../studio.config.json";

export const CONFIG = raw as {
  appName: string;
  appSlug: string;
  appUrl: string;
  appRepoPath: string;
  /** logo file under public/ (SVG, single colour, drawn in C.text) */
  logo: string;
};

/** A config value, or `fallback` while it is still a {{…}} placeholder. */
export const filled = (value: string, fallback: string) => (value.startsWith("{{") ? fallback : value);

#!/usr/bin/env node
// PostToolUse hook: when Claude edits videos/<slug>/timeline.json, re-resolve it.
// Validation errors exit with code 2 so Claude sees them and fixes the timeline.

import { sync } from "./sync.mjs";

let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  let filePath = "";
  try {
    filePath = JSON.parse(input).tool_input?.file_path ?? "";
  } catch {
    process.exit(0);
  }
  const m = /videos\/([^/]+)\/timeline\.json$/.exec(filePath);
  if (!m) process.exit(0);
  try {
    sync(m[1]);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
});

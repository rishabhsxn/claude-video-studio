#!/usr/bin/env bash
# Lists every {{PLACEHOLDER}} and FILL: marker still waiting for your product's details.
# Prints nothing (exit 0) when the studio is fully set up. Fill them with `/promo-video setup`.
cd "$(dirname "$0")/.."
hits=$(grep -rnE "\{\{[A-Z0-9_]+\}\}|FILL:" studio.config.json brand src CLAUDE.md 2>/dev/null)
if [[ -n "$hits" ]]; then
  echo "$hits"
  echo
  echo "$(echo "$hits" | wc -l | tr -d ' ') lines still have placeholders. Run /promo-video setup in Claude Code."
  exit 1
fi

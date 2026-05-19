#!/usr/bin/env bash
# Start the @aivo/web-v2 Next.js dev server.
#
# Ensures @aivo/brand token CSS + Tailwind preset are built before
# web-v2 starts compiling. Without this, the `@import "@aivo/brand/tokens.css"`
# in apps/web-v2/app/globals.css resolves to a non-existent dist file
# and the Inclusive-Lab Warm tokens never load.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BRAND_DIR="$REPO_ROOT/packages/brand"
WEB_DIR="$REPO_ROOT/apps/web-v2"

if [ ! -d "$BRAND_DIR" ] || [ ! -d "$WEB_DIR" ]; then
  echo "[start-web-v2] expected monorepo layout not found under $REPO_ROOT" >&2
  exit 1
fi

(cd "$BRAND_DIR" && node ./scripts/build-tokens.mjs)

cd "$WEB_DIR"
exec ./node_modules/.bin/next dev --port 5000 --turbopack --hostname 0.0.0.0

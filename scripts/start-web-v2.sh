#!/usr/bin/env bash
# Start the @aivo/web-v2 Next.js dev server.
#
# Ensures @aivo/brand token CSS + Tailwind preset are built before
# web-v2 starts compiling. Without this, the `@import "@aivo/brand/tokens.css"`
# in apps/web-v2/app/globals.css resolves to a non-existent dist file
# and the Inclusive-Lab Warm tokens never load.
set -e

(cd "$(dirname "$0")/../packages/brand" && node ./scripts/build-tokens.mjs)

cd "$(dirname "$0")/../apps/web-v2"
exec ./node_modules/.bin/next dev --port 5000 --turbopack --hostname 0.0.0.0

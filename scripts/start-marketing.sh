#!/usr/bin/env bash
# Start the marketing Next.js dev server.
#
# Notes for Replit's workflow supervisor:
#   * We bind Next.js directly to port 3003 (a declared local port in
#     .replit, mapped 3003 -> 3003) so the workflow's `waitForPort = 3003`
#     probe sees a real local listener. Replit's workflow supervisor only
#     recognizes ports that are declared as `localPort` in .replit and
#     probes the **local** port the process actually opens. Earlier
#     attempts that bound 5173/8000 (which appear only as externalPort
#     targets, not declared localPorts) failed with DIDNT_OPEN_A_PORT
#     even though the dev server was healthy and served HTTP 200 — the
#     supervisor was watching a port that the process never opened
#     locally. 3003 was the only free "clean" declared port (localPort
#     == externalPort) in the supported set, matching the pattern used
#     by the working Web App (5000), Brain (3002) and Identity (3001)
#     workflows.
#   * We still background a curl warmup loop so Turbopack compiles the
#     root page quickly and the supervisor's HTTP probe gets a 200.
set -e
# Ensure @aivo/brand token CSS + tailwind preset are built before
# marketing starts compiling — without this, the `@import "@aivo/brand/tokens.css"`
# in app/layout.tsx resolves to a non-existent dist file and the
# Inclusive-Lab Warm tokens never load.
(cd "$(dirname "$0")/../packages/brand" && node ./scripts/build-tokens.mjs)

cd "$(dirname "$0")/../apps/marketing"

(
  for i in $(seq 1 60); do
    sleep 1
    if curl -sS -o /dev/null --max-time 3 http://localhost:3003/ >/dev/null 2>&1; then
      echo "[start-marketing] Warmup hit succeeded on attempt $i"
      exit 0
    fi
  done
  echo "[start-marketing] Warmup gave up after 60 attempts"
) &

exec ./node_modules/.bin/next dev --port 3003 --turbopack --hostname 0.0.0.0

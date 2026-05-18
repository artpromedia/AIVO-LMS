#!/usr/bin/env bash
# Start the marketing Next.js dev server.
#
# Notes for Replit's workflow supervisor:
#   * We bind Next.js directly to port 5173 (a supported Replit port)
#     so the workflow's `waitForPort = 5173` probe sees a real local
#     listener. Previously we bound to localPort 3004 with a
#     3004 -> 5173 external mapping, but Replit's workflow supervisor
#     probes the **local** port the process actually opens, not the
#     external mapping. The dev server was healthy on 3004, served
#     HTTP 200, and the warmup loop succeeded, but the supervisor was
#     watching for a listener on 5173 locally — which never appeared —
#     so it killed the workflow with DIDNT_OPEN_A_PORT. Binding to
#     5173 directly removes the indirection.
#   * We still background a curl warmup loop so Turbopack compiles the
#     root page quickly and the supervisor's HTTP probe gets a 200.
set -e
cd "$(dirname "$0")/../apps/marketing"

(
  for i in $(seq 1 60); do
    sleep 1
    if curl -sS -o /dev/null --max-time 3 http://localhost:5173/ >/dev/null 2>&1; then
      echo "[start-marketing] Warmup hit succeeded on attempt $i"
      exit 0
    fi
  done
  echo "[start-marketing] Warmup gave up after 60 attempts"
) &

exec ./node_modules/.bin/next dev --port 5173 --turbopack --hostname 0.0.0.0

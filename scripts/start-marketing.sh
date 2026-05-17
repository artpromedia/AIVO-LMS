#!/usr/bin/env bash
# Start the marketing Next.js dev server.
#
# Notes for Replit's workflow supervisor:
#   * .replit maps localPort 3004 -> externalPort 5173.
#     We bind 3004 locally so `waitForPort = 5173` is satisfied via
#     the external-port mapping (`openPorts: [5173]`).
#   * We background a curl warmup loop so Turbopack compiles the
#     root page quickly and the supervisor's HTTP probe gets a 200.
set -e
cd "$(dirname "$0")/../apps/marketing"

(
  for i in $(seq 1 60); do
    sleep 1
    if curl -sS -o /dev/null --max-time 3 http://localhost:3004/ >/dev/null 2>&1; then
      echo "[start-marketing] Warmup hit succeeded on attempt $i"
      exit 0
    fi
  done
  echo "[start-marketing] Warmup gave up after 60 attempts"
) &

exec ./node_modules/.bin/next dev --port 3004 --turbopack --hostname 0.0.0.0

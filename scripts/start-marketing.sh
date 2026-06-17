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

# Free port 3003 before we bind it. Replit's workflow supervisor signals the
# workflow's main process, but Next.js in Turbopack mode forks a separate
# `next-server` child (cwd = apps/marketing) that can outlive the parent and
# keep port 3003 bound — making the next restart die with
# `EADDRINUSE: address already in use 0.0.0.0:3003`. Neither `fuser` nor `ss`
# is available in this image, so we find strays by matching their working
# directory via /proc and kill them. Scoped to apps/marketing so the Web App's
# own next-server (cwd = apps/web-v2) is never touched.
MARKETING_DIR="$(cd "$(dirname "$0")/../apps/marketing" && pwd)"
for pid_dir in /proc/[0-9]*; do
  pid="${pid_dir#/proc/}"
  [ "$pid" = "$$" ] && continue
  [ "$(readlink "$pid_dir/cwd" 2>/dev/null || true)" = "$MARKETING_DIR" ] || continue
  cmd="$(tr '\0' ' ' < "$pid_dir/cmdline" 2>/dev/null || true)"
  case "$cmd" in
    *next*) echo "[start-marketing] Killing stray marketing process $pid ($cmd)"; kill "$pid" 2>/dev/null || true ;;
  esac
done
sleep 1

cd "$MARKETING_DIR"

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

#!/usr/bin/env bash
# Build the marketing Next.js site, start it on a local port, and run the
# same per-route marker assertions that production smoke-checks
# (verify-marketing-deploy.sh) run against https://aivolearning.com.
#
# Goal: catch a redesign that drops a marker BEFORE it merges, instead of
# after it has shipped to real visitors. Coverage today (defined in
# scripts/marketing-markers.sh):
#   /                  Hero "Learning adventures" + Footer COPPA/FERPA/SOC 2
#   /privacy-policy    COPPA/FERPA + "Children's Online Privacy Protection"
#   /coppa-compliance  compliance@aivolearning.com + verifiable parental consent
#   /ferpa-compliance  "FERPA Compliance Statement" + "SOC 2 Type II"
#
# Usage:
#   scripts/verify-marketing-build.sh
#
# Env:
#   PORT           Port to start the marketing server on (default: 4173).
#                  We auto-pick an alternate if PORT is occupied.
#   STARTUP_TIMEOUT Seconds to wait for the server to start (default: 90).
#   CURL_TIMEOUT   Per-request timeout in seconds (default: 20).
#   CURL_RETRIES   Retries on transient failures (default: 3).
#   SKIP_BUILD     If "1", reuse an existing apps/marketing/.next build.
#
# Exit code is non-zero on any failure (build, startup, HTTP, missing marker).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="${REPO_ROOT}/scripts"

# shellcheck source=scripts/marketing-markers.sh
source "${SCRIPT_DIR}/marketing-markers.sh"

PORT="${PORT:-4173}"
STARTUP_TIMEOUT="${STARTUP_TIMEOUT:-90}"
TIMEOUT="${CURL_TIMEOUT:-20}"
RETRIES="${CURL_RETRIES:-3}"

log() { printf '[verify-marketing-build] %s\n' "$*"; }

# Pick a free port if the requested one is busy. We try a small ladder before
# bailing — keeps CI happy if the runner is doing something on 4173.
port_in_use() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "sport = :$1" 2>/dev/null | grep -q LISTEN
  elif command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
  else
    # Fallback: assume free if we can't probe.
    return 1
  fi
}
for candidate in "$PORT" 4174 4175 4176 4177; do
  if ! port_in_use "$candidate"; then
    PORT="$candidate"
    break
  fi
done
log "Using port ${PORT}"

cd "$REPO_ROOT"

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  log "Building @aivo/marketing (next build)..."
  pnpm --filter @aivo/marketing build
else
  log "SKIP_BUILD=1, reusing existing build"
fi

server_log="$(mktemp)"
server_pid=""

cleanup() {
  if [[ -n "$server_pid" ]] && kill -0 "$server_pid" 2>/dev/null; then
    log "Stopping marketing server (pid ${server_pid})"
    kill "$server_pid" 2>/dev/null || true
    # Give it a moment to exit cleanly, then force.
    for _ in 1 2 3 4 5; do
      kill -0 "$server_pid" 2>/dev/null || break
      sleep 1
    done
    kill -9 "$server_pid" 2>/dev/null || true
  fi
  if [[ -n "${server_log:-}" && -f "$server_log" ]]; then
    rm -f "$server_log"
  fi
}
trap cleanup EXIT INT TERM

log "Starting marketing server on port ${PORT}..."
# `next start` serves the production build from .next/. We pin HOSTNAME so the
# server binds to loopback only — avoids surprising CI runners with an open
# port. Logs are tee'd to a temp file so we can dump them on failure.
(
  cd apps/marketing
  HOSTNAME=127.0.0.1 PORT="$PORT" exec ./node_modules/.bin/next start --port "$PORT" --hostname 127.0.0.1
) >"$server_log" 2>&1 &
server_pid=$!
log "Server pid: ${server_pid}"

BASE_URL="http://127.0.0.1:${PORT}"

log "Waiting up to ${STARTUP_TIMEOUT}s for ${BASE_URL}/ to respond..."
ready=0
for i in $(seq 1 "$STARTUP_TIMEOUT"); do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    log "FAIL: marketing server exited before becoming ready"
    log "----- server log -----"
    cat "$server_log" || true
    exit 1
  fi
  if curl --silent --fail --show-error --max-time 3 --output /dev/null "${BASE_URL}/" 2>/dev/null; then
    ready=1
    log "Server responsive after ${i}s"
    break
  fi
  sleep 1
done

if [[ "$ready" != "1" ]]; then
  log "FAIL: server did not become ready within ${STARTUP_TIMEOUT}s"
  log "----- server log -----"
  cat "$server_log" || true
  exit 1
fi

log "Running marker assertions across ${#MARKETING_ROUTES[@]} route(s)"
tmp_body="$(mktemp)"
trap 'cleanup; rm -f "$tmp_body"' EXIT

failures=()
total_markers=0

for route in "${MARKETING_ROUTES[@]}"; do
  target="${BASE_URL}${route}"
  log "GET ${target}"

  http_code="$(
    curl --silent \
         --show-error \
         --location \
         --max-time "$TIMEOUT" \
         --retry "$RETRIES" \
         --retry-all-errors \
         --retry-delay 2 \
         --user-agent "aivo-marketing-build-check/1.0" \
         --output "$tmp_body" \
         --write-out "%{http_code}" \
         "$target"
  )" || {
    log "FAIL: curl could not reach ${target}"
    log "----- server log -----"
    cat "$server_log" || true
    exit 1
  }

  if [[ "$http_code" != "200" ]]; then
    log "FAIL: expected HTTP 200, got ${http_code} for ${target}"
    log "----- response body (truncated) -----"
    head -c 2000 "$tmp_body" || true
    echo
    log "----- server log -----"
    cat "$server_log" || true
    exit 1
  fi
  log "OK: HTTP 200 for ${route}"

  mapfile -t markers < <(marketing_markers_for "$route")
  for marker in "${markers[@]}"; do
    total_markers=$((total_markers + 1))
    if grep -qiF -- "$marker" "$tmp_body"; then
      log "OK: ${route} contains marker \"${marker}\""
    else
      log "FAIL: ${route} missing marker \"${marker}\""
      failures+=("${route}: missing marker \"${marker}\"")
    fi
  done

  # Citation-guard check: numeric claims rendered on the page must carry a
  # documented source.  Violations are printed by marketing_citation_guard
  # and collected here so the overall failure report stays in one place.
  mapfile -t cite_violations < <(marketing_citation_guard "$route" "$tmp_body")
  for v in "${cite_violations[@]}"; do
    [[ -n "$v" ]] || continue
    log "FAIL: ${v}"
    failures+=("$v")
  done
done

if (( ${#failures[@]} > 0 )); then
  echo
  log "=== verify-marketing-build: FAILED (${#failures[@]} marker(s) missing) ==="
  for f in "${failures[@]}"; do
    log "  - ${f}"
  done
  log "A redesign in apps/marketing/** removed a marker that the production"
  log "smoke check (verify-marketing-deploy.sh) requires. Either restore the"
  log "marker text on the page, or — if the change is intentional — update"
  log "scripts/marketing-markers.sh in the same PR."
  exit 1
fi

echo
log "=== verify-marketing-build: PASS — ${total_markers} marker(s) across ${#MARKETING_ROUTES[@]} route(s) ==="

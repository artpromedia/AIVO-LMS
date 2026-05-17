#!/usr/bin/env bash
# Smoke-check the production marketing deployment at https://aivolearning.com.
#
# Asserts, for every path in MARKETING_ROUTES (defined in marketing-markers.sh):
#   1. The URL returns HTTP 200.
#   2. The response body contains every required marker substring for that
#      path (case-insensitive). Coverage today:
#        /                  Hero "Learning adventures" + Footer COPPA/FERPA/SOC 2
#        /privacy-policy    COPPA/FERPA + "Online Privacy Protection Act"
#        /coppa-compliance  "school and district inquiries" + verifiable parental consent
#        /ferpa-compliance  "FERPA Compliance Statement" + "SOC 2 Type II"
#
# Iterates every (path, marker) pair and reports ALL failures at the end so
# the on-call human sees the full picture (which page broke, and which
# marker was missing) without having to re-run the script per page.
#
# Usage:
#   scripts/verify-marketing-deploy.sh                      # checks aivolearning.com
#   MARKETING_URL=https://staging.example.com \
#     scripts/verify-marketing-deploy.sh                    # override target origin
#
# Env:
#   MARKETING_URL  Target origin (default: https://aivolearning.com/). The
#                  script strips the trailing slash and appends each path
#                  from MARKETING_ROUTES, so set this to an origin (no path).
#   CURL_TIMEOUT   Per-request timeout in seconds (default: 20)
#   CURL_RETRIES   Retries on transient failures (default: 3)

set -euo pipefail

URL="${MARKETING_URL:-https://aivolearning.com/}"
TIMEOUT="${CURL_TIMEOUT:-20}"
RETRIES="${CURL_RETRIES:-3}"

# Routes + per-route markers are defined in scripts/marketing-markers.sh so
# the production smoke check and the PR-time build check assert the exact
# same strings against the exact same paths.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/marketing-markers.sh
source "${SCRIPT_DIR}/marketing-markers.sh"

# Treat MARKETING_URL as the origin and strip any trailing slash so we can
# safely append per-route paths (which all start with "/").
BASE_URL="${URL%/}"

tmp_body="$(mktemp)"
tmp_headers="$(mktemp)"
trap 'rm -f "$tmp_body" "$tmp_headers"' EXIT

failures=()
total_markers=0
checked_routes=0

for route in "${MARKETING_ROUTES[@]}"; do
  target="${BASE_URL}${route}"
  echo "=== verify-marketing-deploy: GET ${target} ==="

  # Capture the HTTP status separately via --write-out so we can give a
  # useful error message on non-200 responses (instead of relying on
  # --fail, which would discard the body). --retry handles transient
  # network blips.
  http_code="$(
    curl --silent \
         --show-error \
         --location \
         --max-time "$TIMEOUT" \
         --retry "$RETRIES" \
         --retry-all-errors \
         --retry-delay 2 \
         --user-agent "aivo-marketing-smoke/1.0" \
         --output "$tmp_body" \
         --dump-header "$tmp_headers" \
         --write-out "%{http_code}" \
         "$target"
  )" || {
    echo "FAIL: curl could not reach ${target}"
    echo "----- response headers (if any) -----"
    cat "$tmp_headers" || true
    failures+=("${route}: curl could not reach ${target}")
    continue
  }

  if [[ "$http_code" != "200" ]]; then
    echo "FAIL: expected HTTP 200, got ${http_code} for ${target}"
    echo "----- response headers -----"
    cat "$tmp_headers"
    failures+=("${route}: expected HTTP 200, got ${http_code}")
    continue
  fi
  echo "OK: HTTP 200 for ${route}"

  mapfile -t markers < <(marketing_markers_for "$route")
  checked_routes=$((checked_routes + 1))
  for marker in "${markers[@]}"; do
    total_markers=$((total_markers + 1))
    if grep -qiF -- "$marker" "$tmp_body"; then
      echo "OK: ${route} contains marker \"${marker}\""
    else
      echo "FAIL: ${route} missing marker \"${marker}\""
      failures+=("${route}: missing marker \"${marker}\"")
    fi
  done
done

if (( ${#failures[@]} > 0 )); then
  echo
  echo "=== verify-marketing-deploy: FAILED (${#failures[@]} issue(s)) ==="
  for f in "${failures[@]}"; do
    echo "  - ${f}"
  done
  echo "Likely causes:"
  echo "  - Custom domain re-pointed away from the Replit autoscale deployment"
  echo "  - Build served a blank/old shell"
  echo "  - A homepage or compliance-page redesign dropped a required marker"
  echo "  - An i18n key rename silently blanked a Privacy / COPPA / FERPA section"
  echo "Inspect: curl -sI ${BASE_URL}/ ; check Deployments → Custom Domains in Replit"
  exit 1
fi

echo
echo "=== verify-marketing-deploy: PASS — ${total_markers} marker(s) across ${checked_routes} route(s) ==="

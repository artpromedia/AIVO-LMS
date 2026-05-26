#!/usr/bin/env bash
# Sprint 12 — drive the full load suite in sequence.
#
# Outputs go to scripts/load/out/<endpoint>.json so the Grafana dashboard
# (infra/grafana/baseline-ops.json) can ingest them. Any threshold
# violation fails the run with a non-zero exit code — the v1.0 cut
# refuses to ship until every endpoint clears its SLO.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="${SCRIPT_DIR}/out"
mkdir -p "${OUT_DIR}"

required_envs=(K6_API_TOKEN K6_TENANT_ID K6_LEARNER_ID)
for var in "${required_envs[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "ERR: ${var} must be set." >&2
    exit 1
  fi
done

if ! command -v k6 >/dev/null 2>&1; then
  echo "ERR: k6 not installed. brew install k6 / apt-get install k6 / use the grafana/k6 docker image." >&2
  exit 1
fi

declare -a SUITES=(
  "baseline-generate"
  "iep-draft"
  "school-dashboard"
  "therapist-sessions"
  "baseline-metrics"
)

failed=()
for suite in "${SUITES[@]}"; do
  echo
  echo "==> Running ${suite}…"
  if k6 run \
      --summary-export "${OUT_DIR}/${suite}-summary.json" \
      --out "json=${OUT_DIR}/${suite}.json" \
      "${SCRIPT_DIR}/${suite}.js"; then
    echo "    ${suite}: PASSED"
  else
    echo "    ${suite}: FAILED"
    failed+=("${suite}")
  fi
done

echo
if [[ ${#failed[@]} -gt 0 ]]; then
  echo "Load suite FAILED: ${failed[*]}" >&2
  exit 1
fi
echo "Load suite PASSED — every endpoint cleared its SLO."

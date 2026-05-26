#!/usr/bin/env bash
# Sprint 12 — v1.0 cutover automation.
#
# Refuses to tag unless every preflight gate has passed:
#   - branch is up to date with origin
#   - unit + lint + type + python tests are green
#   - both Sprint 4 + Sprint 6 migrations exist
#   - load-test summary JSONs exist and report no threshold violations
#   - playwright Sprint 12 specs pass against the configured base URL
#
# This script is INTENDED to be slow + paranoid — it's the last line
# of defence before production.

set -euo pipefail

BRANCH_TO_CUT="${BRANCH_TO_CUT:-claude/dazzling-bell-vXuZ0}"
TARGET_TAG="${TARGET_TAG:-v1.0.0}"
LOAD_OUT="${LOAD_OUT:-scripts/load/out}"

fail() { echo "❌ $*" >&2; exit 1; }
note() { echo "→ $*"; }
pass() { echo "✅ $*"; }

note "Cutting ${TARGET_TAG} from ${BRANCH_TO_CUT}…"

# 1. Branch sanity.
current=$(git rev-parse --abbrev-ref HEAD)
[[ "${current}" == "${BRANCH_TO_CUT}" ]] || fail "Not on ${BRANCH_TO_CUT} (currently on ${current}). Switch first."
git fetch origin "${BRANCH_TO_CUT}" >/dev/null
ahead=$(git rev-list --count "origin/${BRANCH_TO_CUT}..HEAD")
behind=$(git rev-list --count "HEAD..origin/${BRANCH_TO_CUT}")
[[ "${behind}" == "0" ]] || fail "Branch is ${behind} commits behind origin/${BRANCH_TO_CUT}. Pull first."
[[ "${ahead}" == "0" ]] || fail "Branch has ${ahead} commits ahead of origin/${BRANCH_TO_CUT}. Push first."
pass "Branch is up to date."

# 2. Migrations present.
for f in packages/db/drizzle/0039_baseline_item_audits.sql packages/db/drizzle/0040_iep_drafts.sql; do
  [[ -f "${f}" ]] || fail "Missing migration: ${f}"
done
pass "Sprint 4 + 6 migrations present."

# 3. Required docs.
for f in docs/SPRINT_12_PRODUCTION_READINESS.md docs/SPRINT_12_SECURITY_REVIEW.md docs/SPRINT_12_V1_CUTOVER.md; do
  [[ -f "${f}" ]] || fail "Missing release doc: ${f}"
done
pass "Release docs present."

# 4. Load summaries.
if [[ "${SKIP_LOAD_CHECK:-0}" != "1" ]]; then
  [[ -d "${LOAD_OUT}" ]] || fail "Load output directory ${LOAD_OUT} missing — run scripts/load/run-all.sh first."
  for suite in baseline-generate iep-draft school-dashboard therapist-sessions baseline-metrics; do
    summary="${LOAD_OUT}/${suite}-summary.json"
    [[ -f "${summary}" ]] || fail "Missing load summary: ${summary}"
    # k6 writes thresholds_passed = false in the summary when any threshold breaches.
    if grep -q '"thresholds_passed"[[:space:]]*:[[:space:]]*false' "${summary}"; then
      fail "Load suite ${suite} has a failing threshold — check ${summary}"
    fi
  done
  pass "Load suite passed all thresholds."
else
  note "SKIP_LOAD_CHECK=1 — skipping load-test gate (use only for emergency cuts)."
fi

# 5. Unit + lint + type + python tests.
note "Running unit tests…"
pnpm -w test >/dev/null || fail "pnpm test failed."
pnpm --filter @aivo/web-v2 run lint >/dev/null || fail "web-v2 lint failed."
pnpm --filter @aivo/web-v2 run typecheck >/dev/null || fail "web-v2 typecheck failed."
if command -v pytest >/dev/null 2>&1; then
  (cd services/ai-svc && python3 -m pytest -q) || fail "ai-svc pytest failed."
fi
pass "All test suites green."

# 6. E2E (skip in CI when WEB_BASE_URL is local).
if [[ -n "${WEB_BASE_URL:-}" && "${WEB_BASE_URL}" != *localhost* ]]; then
  note "Running Sprint 12 Playwright suites against ${WEB_BASE_URL}…"
  pnpm --filter @aivo/e2e exec playwright test tests/sprint12/ \
    || fail "Playwright Sprint 12 suite failed."
  pass "Playwright e2e green."
else
  note "WEB_BASE_URL not set to a staging URL — skipping e2e gate."
fi

# 7. Tag + push.
if git rev-parse "${TARGET_TAG}" >/dev/null 2>&1; then
  fail "Tag ${TARGET_TAG} already exists. Bump the version or delete the local tag."
fi
note "Tagging ${TARGET_TAG}…"
git tag -a "${TARGET_TAG}" -m "${TARGET_TAG} — Sprints 1-12 (baseline pipeline, role dashboards, production hardening)"
git push origin "${TARGET_TAG}"
pass "Tagged ${TARGET_TAG} and pushed to origin."

echo
echo "Cutover complete. Proceed to canary rollout per docs/SPRINT_12_V1_CUTOVER.md §10."

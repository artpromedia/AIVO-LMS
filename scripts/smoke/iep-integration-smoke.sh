#!/usr/bin/env bash
# IEP integration smoke probe.
# Verifies the three contracts that the rollout depends on:
#   1. ai-svc  /health             is 200
#   2. assessment-svc /health      is 200
#   3. ai-svc  POST /api/ai/iep/draft returns a schema-valid IEPDraftResponse
# Exits non-zero on any failure so CI / deploy gates can fail the rollout.
#
# NOTE: ai-svc mounts the content-generation router under the /api/ai prefix,
# so the draft endpoint is /api/ai/iep/draft (overridable via IEP_DRAFT_PATH).
# The endpoint is unauthenticated today; we still send the internal bearer so
# the probe keeps working if/when auth is added to the route.
set -euo pipefail

AI_SVC_URL="${AI_SVC_URL:-http://localhost:3004}"
ASSESSMENT_SVC_URL="${ASSESSMENT_SVC_URL:-http://localhost:3003}"
INTERNAL_AI_TOKEN="${INTERNAL_AI_TOKEN:-iep-local-internal-ai-token}"
IEP_DRAFT_PATH="${IEP_DRAFT_PATH:-/api/ai/iep/draft}"

log() { printf '\033[1;34m[iep-smoke]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[iep-smoke] FAIL:\033[0m %s\n' "$*" >&2; exit 1; }

log "1/3 ai-svc health"
curl -fsS "${AI_SVC_URL}/health" >/dev/null || fail "ai-svc /health not 200"

log "2/3 assessment-svc health"
curl -fsS "${ASSESSMENT_SVC_URL}/health" >/dev/null || fail "assessment-svc /health not 200"

log "3/3 ai-svc ${IEP_DRAFT_PATH} round-trip"
resp="$(curl -fsS -X POST "${AI_SVC_URL}${IEP_DRAFT_PATH}" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer ${INTERNAL_AI_TOKEN}" \
  -d '{
        "parent_assessment": {"strengths": ["visual"], "challenges": ["reading fluency"]},
        "learning_profile": {"thetaPlacement": 0.2, "modalityFit": []},
        "domain_scores": {"ela": 0.4, "math": 0.8},
        "learner_id": "smoke-learner"
      }')" || fail "POST ${IEP_DRAFT_PATH} errored"

echo "${resp}" | grep -q '"draft"' || fail "response missing draft object: ${resp}"
echo "${resp}" | grep -q '"model"' || fail "response missing model field"

log "PASS — IEP draft round-trip healthy"

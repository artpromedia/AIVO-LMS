#!/bin/bash
set -e

# Boot order matters here. We have ~14 backend services that all run via tsx
# (Node + ESM transformer) plus the Python ai-svc. Launching all of them in
# parallel exhausts the container's process / thread budget on a fresh boot
# (`EAGAIN` fork errors, `ERR_WORKER_INIT_FAILED` from tsx) and starves the
# Next.js workflows of CPU long enough that their port-readiness check times
# out. We deliberately fan them out in small groups with a brief pause
# between each group — see replit.md "Backend boot ordering" for context.

echo "Starting AIVO backend services..."

echo "Building shared packages..."
cd /home/runner/workspace
pnpm --filter @aivo/observability run build 2>/dev/null || true
pnpm --filter @aivo/brand run build 2>/dev/null || true
pnpm --filter @aivo/events run build 2>/dev/null || true
pnpm --filter @aivo/security run build 2>/dev/null || true
pnpm --filter @aivo/scoring run build 2>/dev/null || true
pnpm --filter @aivo/sso run build 2>/dev/null || true
pnpm --filter @aivo/db run build 2>/dev/null || true
pnpm --filter @aivo/learner-ui run build 2>/dev/null || true
echo "Shared packages built."

TSX_BIN=$(which tsx 2>/dev/null || echo "npx tsx")
mkdir -p /tmp/svc-logs

# Each group is launched in parallel; we sleep briefly between groups to let
# the previous tsx workers finish their initial parse + bind their ports
# before more processes pile on. Two seconds is plenty in practice and adds
# only ~8s to total cold-boot time.
GROUP_PAUSE=2

# ── Group 1: foundational (auth + comms backbone) ─────────────────────────
echo "Group 1: identity-svc, comms-svc, i18n-svc"
( cd /home/runner/workspace/services/identity-svc && NODE_ENV=development $TSX_BIN src/index.ts ) &
( cd /home/runner/workspace/services/comms-svc && COMMS_SVC_PORT=3010 NODE_ENV=development $TSX_BIN src/index.ts ) &
( cd /home/runner/workspace/services/i18n-svc && I18N_SVC_PORT=3011 NODE_ENV=development $TSX_BIN src/index.ts ) &
sleep "$GROUP_PAUSE"

# ── Group 2: data services ────────────────────────────────────────────────
echo "Group 2: assessment-svc, learning-svc"
( cd /home/runner/workspace/services/assessment-svc && ASSESSMENT_PORT=3003 NODE_ENV=development $TSX_BIN src/index.ts > /tmp/svc-logs/assessment-svc.log 2>&1 ) &
( cd /home/runner/workspace/services/learning-svc && LEARNING_PORT=3005 NODE_ENV=development $TSX_BIN src/index.ts ) &
sleep "$GROUP_PAUSE"

# ── Group 3: tutor + family + engagement ──────────────────────────────────
echo "Group 3: tutor-svc, family-svc, engagement-svc"
( cd /home/runner/workspace/services/tutor-svc && TUTOR_PORT=3006 NODE_ENV=development $TSX_BIN src/index.ts ) &
( cd /home/runner/workspace/services/family-svc && FAMILY_PORT=3007 NODE_ENV=development $TSX_BIN src/index.ts ) &
( cd /home/runner/workspace/services/engagement-svc && ENGAGEMENT_PORT=3008 NODE_ENV=development $TSX_BIN src/index.ts ) &
sleep "$GROUP_PAUSE"

# ── Group 4: billing + integrations + admin ───────────────────────────────
echo "Group 4: billing-svc, integrations-svc, admin-svc"
( cd /home/runner/workspace/services/billing-svc && BILLING_SVC_PORT=3009 NODE_ENV=development $TSX_BIN src/index.ts ) &
( cd /home/runner/workspace/services/integrations-svc && INTEGRATIONS_SVC_PORT=3012 NODE_ENV=development $TSX_BIN src/index.ts ) &
( cd /home/runner/workspace/services/admin-svc && ADMIN_SVC_PORT=3013 NODE_ENV=development $TSX_BIN src/index.ts ) &
sleep "$GROUP_PAUSE"

# ── Group 5: ops + python ─────────────────────────────────────────────────
echo "Group 5: status-page-svc, research-svc, ai-svc (python)"
( cd /home/runner/workspace/services/status-page-svc && STATUS_PAGE_SVC_PORT=3014 NODE_ENV=development $TSX_BIN src/index.ts ) &
( cd /home/runner/workspace/services/research-svc && RESEARCH_SVC_PORT=3015 NODE_ENV=development $TSX_BIN src/index.ts ) &
( cd /home/runner/workspace/services/ai-svc && PYTHONPATH=src python3 -m uvicorn ai_svc.main:app --host 0.0.0.0 --port 3004 ) &

wait

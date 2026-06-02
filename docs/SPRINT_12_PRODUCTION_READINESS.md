# Sprint 12 — Production Readiness

This document captures the production-readiness gates added in Sprint 12
and the e2e / load / security work that ships _next_ (the items here
need real browsers, k6, and a manual review pass — they don't belong in
the unit-test grid).

## Already shipped (Sprints 1-11)

- Sprint 1: curriculum grounding for the baseline generator (flag-gated)
- Sprint 2: structured-output schema + auto-correction retry
- Sprint 3: curated fallback bank, graceful AI-failure degradation
- Sprint 4: responsible-AI gate + `baseline_item_audits` table
- Sprint 5: functioning-level scaffold enforcement + PRE_SYMBOLIC short-circuit
- Sprint 6: baseline → IEP draft pipeline + `iep_drafts` table
- Sprint 7: school-admin dashboard reads live data
- Sprint 8: school reports + class CRUD + staff add/remove
- Sprint 9: therapist caseload / goals / SOAP session notes
- Sprint 10: caregiver ABC observation authoring
- Sprint 11: teacher IEP-draft review queue + gradebook detail

## Sprint 12 deliverables in this branch

1. **Feature-flag admin surface** at `/admin/platform/feature-flags`.
   Read-only by design — env vars stay the source of truth so the
   runbook and the runtime can never disagree. Backed by
   `ENTERPRISE_FLAG_META` in `@aivo/feature-flags` so every flag carries
   a label, description, risk band, and default value.

2. **Baseline pipeline observability** at
   `/api/bff/admin/baseline-metrics`. Returns:
   - total evaluated items in window
   - block rate %
   - fallback share of shipped items
   - histogram of `recommendedAction` values
   - top violation codes

3. **Lifecycle docs** (this file).

## E2E test plan (handed off to QA)

40 golden-path scenarios — 8 per user role × 5 roles. Each one runs
through Playwright with `baseURL=https://staging.aivolms.com`.

### Learner (8)

1. First-time learner completes Discovery Adventure baseline.
2. Returning learner opens daily mission, finishes 3 lessons.
3. Learner asks the AI tutor a question — receives age-appropriate reply.
4. Learner attempts homework with scratchpad surface.
5. Learner triggers frustration signal → break-time prompt appears.
6. Learner with NON_VERBAL profile sees emoji-only options.
7. Learner views progress trend, unlocks badge.
8. Learner switches subject mid-session — state persists.

### Parent (8)

1. New parent completes parent assessment + co-parent invite flow.
2. Parent uploads IEP — extraction populates the dashboard.
3. Parent reviews AI-drafted IEP (Sprint 6) and moves to teacher_review.
4. Parent approves baseline-personalized lessons before learner starts.
5. Parent toggles AI tutor access for one learner only.
6. Parent receives billing reminder + completes payment.
7. Parent invites caregiver / therapist via team flow.
8. Parent reads weekly digest, drills into a specific lesson.

### Teacher (8)

1. Teacher creates a class, adds learners.
2. Teacher reviews AI-drafted IEP from `/teacher/iep-drafts`.
3. Teacher progresses draft to `admin_approved`.
4. Teacher opens learner gradebook, identifies a stuck skill.
5. Teacher assigns a custom lesson to a learner.
6. Teacher exports school report CSV.
7. Teacher messages a parent about progress.
8. Teacher sees curriculum-aligned content via Sprint 1 grounding.

### Therapist (8)

1. Therapist accepts a parent invite and lands on `/therapist/home`.
2. Therapist authors a SOAP session note linked to two IEP goals.
3. Therapist signs a note → it locks for edits.
4. Therapist updates goal progress → trend updates.
5. Therapist creates a brand-new SMART goal.
6. Therapist views caseload sorted by next session.
7. Therapist marks a goal "met" via 100% progress.
8. Therapist exports session summary report.

### Caregiver (8)

1. Caregiver accepts invite, lands on `/caregiver/home`.
2. Caregiver authors an ABC observation.
3. Caregiver views their own observation feed and edits one.
4. Caregiver sees lesson activity for assigned learner.
5. Caregiver receives weekly summary email.
6. Caregiver attempts to view another learner — blocked.
7. Caregiver updates settings (language, notifications).
8. Caregiver acknowledges a scheduled session.

## Load test plan

Run k6 with the following ramps against staging:

| Endpoint                               | Target VUs | Duration | p95 SLO  |
| -------------------------------------- | ---------- | -------- | -------- |
| `POST /api/ai/generate-baseline`       | 50         | 5 min    | < 30 s   |
| `POST /api/ai/iep/draft`               | 25         | 5 min    | < 40 s   |
| `GET  /api/bff/admin/school/dashboard` | 200        | 10 min   | < 500 ms |
| `POST /api/bff/therapist/sessions`     | 50         | 5 min    | < 800 ms |
| `GET  /api/bff/admin/baseline-metrics` | 100        | 10 min   | < 600 ms |

Track in Grafana:

- LLM token spend per tenant (sum of `cost_cents` from
  `services/ai-svc/.../llm_gateway.py` log lines).
- Prompt-cache hit rate per (district, gradeBand, functioningLevel)
  cohort. SLO: ≥ 70 % after a 10-minute warm-up.
- Baseline fallback rate (`source = "ai+fallback"` / total). SLO: < 5 %.
- Responsible-AI block rate. SLO: < 2 % (anything higher means the
  prompt or the evaluator is wrong).

## SLO alerts (packages/ops-alert)

Add the following alerts:

- `baseline_p95_latency_seconds > 30` for 5 minutes → page on-call.
- `baseline_fallback_rate_5m > 0.05` for 10 minutes → ops Slack.
- `responsible_ai_block_rate_5m > 0.02` → AI safety triage.
- `llm_token_cost_cents_5m > <tenant cap>` → finance + tenant admin.
- `iep_draft_validation_failure_rate_5m > 0.10` → ai-svc on-call.

## Security review

Run `/security-review` against the full diff before tagging `v1.0`.
Specifically:

- Confirm every new BFF route (Sprints 7-12) calls `requireRole` with
  the minimum-privilege role set.
- Confirm every cross-tenant boundary (therapist, caregiver, teacher
  caseload) returns 403/404 — not 200 with empty payload — when the
  caller is out of scope.
- Confirm the responsible-AI gate fails OPEN only when the evaluator
  is silent across the whole batch (Sprint 4 already enforces this).
- Confirm caregiver attachments (when wired) route through the
  existing file-upload sanitizer and are scoped to the learner.

## Going live

After the e2e + load suites pass and the security review is signed:

1. Tag `v1.0` on `main`.
2. Bump `AIVO_FEATURE_CURRICULUM_GROUNDING`,
   `AIVO_FEATURE_RESPONSIBLE_AI_GUARDRAILS` to `true` in staging
   first, then production after 24 h soak.
3. Watch the Grafana dashboards for 72 h. Roll back the feature flag,
   not the deploy, on regression.

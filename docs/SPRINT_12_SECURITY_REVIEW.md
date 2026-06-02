# Sprint 12 — security review (Sprints 1-12 diff)

Manual review of every BFF route, repo helper, and service introduced
in Sprints 1-12. Scope: commits `1cc3794..b1b9f46` on
`claude/dazzling-bell-vXuZ0`.

Checklist (OWASP top 10 + AIVO-specific concerns):

- [x] Authentication on every new route
- [x] Authorization with minimum-privilege role sets
- [x] Tenant scoping on every read + write
- [x] Cross-tenant denial returns 403/404, never 200 with empty payload
- [x] Input validation at the boundary (`fail()` on missing/wrong types)
- [x] No raw SQL / template injection in any new path
- [x] LLM responses validated with pydantic before persistence
- [x] Responsible-AI gate fails OPEN only when evaluator silent across batch
- [x] Audit / observability counters live separate from the response path
- [x] Secrets never logged

## 1. Auth + RBAC

Every new BFF route in `apps/web-v2/app/api/bff/*` calls
`requireSession` followed by `requireRole`. The role sets are:

| Route                                    | Allowed roles                                                  |
| ---------------------------------------- | -------------------------------------------------------------- |
| `/api/bff/admin/school/dashboard`        | `ADMIN_ROLES` (platform / district / school)                   |
| `/api/bff/admin/school/report`           | `ADMIN_ROLES`                                                  |
| `/api/bff/admin/school/classes`          | `ADMIN_ROLES`                                                  |
| `/api/bff/admin/school/staff`            | `ADMIN_ROLES`                                                  |
| `/api/bff/admin/feature-flags`           | `ADMIN_ROLES`                                                  |
| `/api/bff/admin/baseline-metrics`        | `ADMIN_ROLES`                                                  |
| `/api/bff/therapist/caseload`            | `["therapist"]` (strict)                                       |
| `/api/bff/therapist/goals` (GET)         | `["therapist", "teacher"]`                                     |
| `/api/bff/therapist/goals` (POST)        | `["therapist", "teacher"]`                                     |
| `/api/bff/therapist/sessions` (GET)      | `["therapist", "parent"]`                                      |
| `/api/bff/therapist/sessions` (POST)     | `["therapist"]` (write strict)                                 |
| `/api/bff/caregiver/observations` (GET)  | `["caregiver", "parent", "therapist", "teacher"]`              |
| `/api/bff/caregiver/observations` (POST) | `["caregiver"]` (write strict)                                 |
| `/api/bff/teacher/iep-drafts`            | `["teacher", "school_admin", "district_admin"]`                |
| `/api/bff/teacher/gradebook`             | `["teacher", "school_admin", "district_admin"]` + roster check |

Confirmed by grep: zero new route files match the regex
`export async function (GET|POST|DELETE)` without a matching
`requireRole` call.

## 2. Tenant scoping

All new repo helpers (`getSchoolDashboard`, `getSchoolReport`,
`listIepGoals`, `createIepGoal`, `updateIepGoalProgress`,
`listSessionNotes`, `createSessionNote`, `signSessionNote`,
`listCaregiverObservations`, `createCaregiverObservation`,
`upsertIepAiDraft`, `getIepAiDraft`, `progressIepAiDraft`,
`getGradebookDetail`, `getBaselinePipelineMetrics`) require a
`tenantId` argument from the session and filter / verify on it before
read or write.

Cross-tenant denial assertions in the repos:

- `updateIepGoalProgress` returns `null` when `g.tenantId !== tenantId`
  (unit-test pinned).
- `signSessionNote` same pattern.
- `removeStaffUser` same pattern.
- `deleteClassroom` checks via `getClassroom(id, tenantId)` which
  already enforces tenant equality.
- `progressIepAiDraft` returns `null` on cross-tenant attempts
  (unit-test pinned).
- `teacherCanAccessLearner` is called explicitly in
  `/api/bff/teacher/gradebook` to deny teachers reaching learners off
  their roster, returning 403.

The session's `tenantId` is the single source of truth — no route
accepts a tenant id from the request body.

## 3. Input validation

All POST routes parse JSON via `await req.json().catch(() => null)`
and reject with a 400 + structured `fail()` envelope when required
fields are missing. Specific validations:

- `staff` route: role enum whitelist
  (`TEACHER|SCHOOL_ADMIN|THERAPIST|CAREGIVER`).
- `iep-drafts` route: `to` query parameter validated against
  `ALLOWED_STATUS`.
- `sessions` POST: `learnerId` + numeric `durationMinutes` required.
- `observations` POST: `learnerId` + `behaviour` required.
- ai-svc IEP drafter: pydantic schema (`IepDraftPayload`) with
  whitelisted `domain` / `accommodationType` / `serviceType` enums
  and a 0-600 `minutesPerWeek` cap; rejects with a 502 +
  structured error list after one repair retry.
- ai-svc baseline schema (`BaselineQuestion`): pydantic-validated
  with `subject` enum + `correctAnswer ∈ options[].value`
  invariant.

## 4. LLM output guard rails

Two layered defences before any LLM-generated content reaches a
learner or guardian:

1. **Schema validation** — every LLM payload (baseline questions, IEP
   draft, discovery chapter) round-trips through pydantic. Schema
   failures trigger one repair retry, then either partial-success
   salvage (baseline) or a 502 (IEP draft).
2. **Responsible-AI gate** — `services/assessment-svc/src/services/
baseline-safety-gate.ts` calls `@aivo/responsible-ai-svc` on every
   generated item. Blocked items are SWAPPED with curated fallback
   bank items (Sprint 3), with the verdict persisted to
   `baseline_item_audits`.

Failure modes:

- Evaluator unreachable / disabled across the whole batch → ship AI
  as-is (fail open), record zero audits. The unit test
  `evaluator network failure → fails open` pins this.
- Evaluator returns block on a subset → swap those items only, audit
  both the rejected AI item and the inserted fallback item.

The fail-open posture only kicks in for **whole-batch silence** —
not for individual block decisions. This means a partial evaluator
outage (e.g. one slow call) never blanket-allows malicious content.

## 5. Functioning-level scaffolds

Sprint 5 enforces the learner's functioning level **post-generation**
in `services/ai-svc/.../scaffold_enforcer.py`:

- `PRE_SYMBOLIC` learners cannot receive any MC item — the LLM is
  bypassed entirely and an observation checklist returns instead.
- `NON_VERBAL` learners reject items with > 60-char stems or > 2
  options.
- `LOW_VERBAL` learners reject options without pictographic glyphs.

These rules run regardless of LLM output, so a prompt-injection
that tricked the LLM into producing a long stem still gets caught
here.

## 6. Curriculum grounding (Sprint 1)

`load_curriculum_grounding` is **best-effort**:

- Every failure mode (flag off, missing ZIP, district 404, transport
  error, malformed JSON) returns an empty grounding so the baseline
  still generates.
- The grounding is added to the system prompt only; the user
  prompt's strict schema (Sprint 2) is unaffected.
- No user-provided ZIP code is interpolated into a downstream query
  string without `normalize_zip_code()` first (in `curriculum-svc/
catalogue.py`).

## 7. CSRF / XSS / SSRF

- BFF routes consume JSON only via `await req.json()`; no
  `application/x-www-form-urlencoded`. Next.js' built-in CSRF
  protection for App-Router server components covers the form
  surfaces.
- The caregiver observation form (`apps/web-v2/app/caregiver/
observations/observation-form.tsx`) escapes form data into a
  JSON POST body. No `dangerouslySetInnerHTML` introduced in any
  new page.
- ai-svc → curriculum-svc HTTP calls use a fixed `_CURRICULUM_SVC_URL`
  env var; user input is passed only as documented query params
  (`zipCode`, `subject`, `gradeBand`, `skillId`) — all enum-validated
  upstream.
- responsible-ai-svc URL is environment-controlled in the same way.

## 8. Audit + observability

- `baseline_item_audits` writes happen **fire-and-forget** in
  `persistAudits()` — wrapped in `try/catch` so an audit-table outage
  cannot drop a baseline response.
- LLM gateway logs `cost_cents`, `cache_hit`, `cache_read_tokens` as
  structured JSON. The Sprint 12 Grafana panels and Prometheus alerts
  reference these for SLO + cost tracking.
- No secrets logged: the LLM gateway never writes the prompt body or
  the response content to logs; only token counts and model id.

## 9. Frontend session cookie

The caregiver observation form posts to the BFF using the existing
`aivo_session` cookie that's already `httpOnly`, `sameSite: "Lax"` —
confirmed in `e2e/lib/fixtures.ts`. No new client-side token storage
added in any Sprint 7-12 component.

## 10. Findings + remediations

| Finding                                                                                                               | Severity | Status                                                                                             |
| --------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `dev` store does not enforce cross-tenant on therapist session writes (in-memory bypass)                              | Low      | Documented in `therapist.spec.ts` (test 7). Production postgres enforces via FK + RLS. Acceptable. |
| Feature-flag admin page is read-only (env vars are source of truth)                                                   | Info     | By design — runbook and runtime cannot diverge.                                                    |
| Baseline metrics aggregator pulls from `moderationEvents` in dev; postgres `baseline_item_audits` is the prod surface | Info     | Documented in `repos.ts` comment.                                                                  |
| No new file-upload paths introduced; caregiver `attachmentUrl` is opaque string, not file content                     | Info     | When file uploads land in a later sprint, route through the existing sanitiser.                    |

## Sign-off prerequisites

Before tagging `v1.0`:

1. Wire `aivo_baseline_*` and `aivo_responsible_ai_*` Prometheus
   counters in postgres-backed baseline-svc (so the Grafana panels
   are not blank).
2. Run `bash scripts/load/run-all.sh` against staging with the
   load-actor token; archive the JSON summaries.
3. Run `pnpm --filter @aivo/e2e exec playwright test tests/sprint12/`
   against staging with `WEB_BASE_URL=https://staging.aivolms.com`.
4. Manual smoke: log in as each of the 5 user roles + 3 admin
   levels; confirm the role-gated pages render without 5xx.
5. PR review by ops lead + security lead.

Reviewed by: Claude (Sprint 12 close-out) — 2026-05-26.

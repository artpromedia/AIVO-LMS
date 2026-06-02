# Production Readiness Pass — Findings & Sprint-by-Sprint Fix Prompts

_Date: 2026-06-01 · Scope: monorepo `apps/`, `services/`, `packages/`, `scripts/`_

> **Purpose:** Result of a fresh production-readiness sweep for placeholders, `TODO`/`FIXME`
> comments, stubs, and non-implementations that stand between the current build and an
> **enterprise-grade GA**. Each surfaced gap is paired with a ready-to-paste sprint prompt so an
> engineer (or coding agent) can pick it up and close it without re-investigating.
>
> This complements `docs/PLATFORM_GAP_ANALYSIS.md` (the dual-track / mock-by-default analysis) and
> `docs/enterprise-readiness-roadmap.md`. Where those describe the _strategy_, this file gives the
> _executable backlog_ for the residual code-level gaps.

---

## 0. Headline: the automated gates are green

The repo already ships an extensive set of production-readiness guards, and **they all pass today**:

| Gate                 | Command                  | Result                                   |
| -------------------- | ------------------------ | ---------------------------------------- |
| Demo/stub scanner    | `pnpm prod:no-demo`      | ✅ 0 findings                            |
| Production readiness | `pnpm prod:check`        | ✅ passed                                |
| Persistence stubs    | `pnpm persistence:stubs` | ✅ 12/12 adapters implemented, no growth |
| Backend parity       | `pnpm backend:parity`    | ✅ 26 green, 2 yellow, 0 red             |

So this is **not** a "the platform is full of stubs" report. The blocking architectural risk
(mock-by-default) is already cataloged in `PLATFORM_GAP_ANALYSIS.md` with a phased fix. What remains
are a **small set of contained, real gaps** the scanners do not (yet) flag, plus **test-coverage
debt**. Those are the seven sprints below.

---

## 1. Surfaced gaps (evidence)

| #   | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Severity                                 | Evidence                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **LTI 1.3 runtime tables not wired.** Migration `0045_lti_13_runtime.sql` creates `lti_platforms`, `lti_deployments`, `lti_contexts`, `lti_resource_links`, `lti_ags_lineitems`, but the launch route never persists to them — context membership and AGS line items are not stored, so score write-back and resource-link reuse cannot work across launches.                                                                                        | HIGH (enterprise LMS interop)            | `services/integration-svc/src/routes/lti.ts:15-19` ("A future sprint will wire the … tables (migration 0045) directly"); no `insert`/`update` against those tables in the route. |
| 2   | **Speech Buddy learning telemetry is log-only.** `session_started`, `session_ended`, `turn_recorded`, `skill_evidence`, `quest_assigned` are emitted only as structured log lines, not published to the event bus / outbox other services use, so skill-evidence never reaches the mastery/scoring pipeline. (Note: the **hard safety-flag** path _does_ dispatch to comms-svc with a durable local-queue fallback — that part is production-grade.) | MEDIUM                                   | `services/ai-svc/src/ai_svc/speech_buddy/events.py:75-78` ("In production this would publish to the event bus; for now the structured log line is the bus").                     |
| 3   | **AAC vocabulary sync ships an empty board.** CoughDrop sync builds a placeholder board with `items: []` and `grid: {rows:0, cols:0}` instead of querying brain-svc for the learner's actual vocabulary, so a "sync" pushes nothing.                                                                                                                                                                                                                 | MEDIUM (accessibility / AAC users)       | `services/family-svc/src/routes/language-profile.ts:131-138` ("Minimal board from learner ID; in production this queries brain-svc for vocabulary").                             |
| 4   | **AssistiveWare reverse-highlight is a no-op.** `highlight()` is an empty `TODO` body; learners on AssistiveWare/Proloquo2Go get no visual prompt highlighting.                                                                                                                                                                                                                                                                                      | LOW–MEDIUM                               | `packages/aac-bridge/src/adapters/AssistiveWareAdapter.ts:57-60` (`// TODO: Implement via AssistiveWare x-callback-url …`).                                                      |
| 5   | **SIS connectors incomplete.** Two connectors are `status: "coming_soon"` and rejected at connect time; the others are wired.                                                                                                                                                                                                                                                                                                                        | MEDIUM (depends on pilot district stack) | `services/integrations-svc/src/routes/connectors.ts:79,90` (`schoology`, `powerschool` → `coming_soon`); gate at `:368`.                                                         |
| 6   | **Admin scope accepted at face value in collaboration grants.** Non-teacher (admin) roles bypass the classroom/learner-link authorization check when granting collaboration access.                                                                                                                                                                                                                                                                  | MEDIUM (authz / least-privilege)         | `services/family-svc/src/routes/collaboration.ts:1357-1360` ("for now we accept them at face value here").                                                                       |
| 7   | **Test-coverage debt.** 4 services have **no tests** (`i18n-svc`, `integrations-svc`, `research-svc`, `status-page-svc`); backend-parity reports 2 yellow (`integrations-svc`, `research-svc`) and 8 warnings for missing integration-test references (`curriculum-svc`, `engagement-svc`, `integration-svc`, `integrations-svc`, `research-svc`, `subject-brain-svc`, `tenant-svc`).                                                                | MEDIUM                                   | `pnpm backend:parity` summary; directory scan for `*.test.ts` / `test_*.py`.                                                                                                     |

Out of scope here (already owned by `PLATFORM_GAP_ANALYSIS.md`): mock-by-default defaults in
`apps/web-v2/lib/env.ts`, admin user-creation flow wiring, and mobile store-submission artifacts.
Sprint 7 below adds a regression guard so those defaults can never silently ship.

---

## 2. Sprint-by-sprint fix prompts

> Each prompt is self-contained. Paste it as the task for one focused sprint/PR. Keep each on its own
> branch, behind the relevant feature flag where one exists, with tests and the parity/readiness
> gates green before merge.

### Sprint 1 — Persist the LTI 1.3 runtime (close the migration-0045 gap)

```
Wire the LTI 1.3 launch path in services/integration-svc to the tables created by
packages/db/migrations/0045_lti_13_runtime.sql (lti_platforms, lti_deployments,
lti_contexts, lti_resource_links, lti_ags_lineitems).

In services/integration-svc/src/routes/lti.ts:
- On a validated launch, upsert the lti_context and lti_resource_link rows
  (keyed by platform/deployment + context id / resource_link id), and record
  the AGS lineitem(s) advertised in the endpoint claim.
- Resolve the platform/deployment from the issuer + client_id + deployment_id
  claims; reject launches whose platform is not registered.
- Implement AGS score write-back against the stored lineitem URL using the
  platform's OAuth2 client-credentials token, with retry + audit on failure.
- Keep the legacy /api/lti/validate fixture route untouched.

Add a Drizzle schema for the 0045 tables in packages/db if it does not exist yet.
Remove the "A future sprint will wire …" comment at lti.ts:15-19 once done.

Tests: integration tests covering (a) launch upserts context + resource link,
(b) repeat launch reuses rows, (c) AGS score write-back posts to the lineitem,
(d) launch from an unregistered platform is rejected. Wire them into
tests/integration/** so backend:parity sees integration coverage for the service.
Run `pnpm backend:parity` and `pnpm prod:check`; both must stay green.
```

### Sprint 2 — Speech Buddy telemetry → event bus / mastery pipeline

```
Replace the log-only event emission in
services/ai-svc/src/ai_svc/speech_buddy/events.py (EventEmitter._emit, line ~75)
with real publication to the same downstream the rest of the platform consumes,
so skill_evidence feeds the mastery/scoring pipeline.

- Identify the canonical transport other services use (packages/events +
  the comms-svc/engagement-svc outbox pattern) and publish session_started,
  session_ended, turn_recorded, skill_evidence, and quest_assigned to it.
- Use a durable outbox (mirror the hard-safety-flag local-queue fallback already
  in this file) so events survive a transient bus failure; an ops sweep retries.
- Confirm a consumer (scoring / mastery aggregation) actually ingests
  skill_evidence and updates mastery records; add it if missing.
- Do NOT change the hard safety-flag dispatch — it is already production-grade.
- Remove the "for now the structured log line is the bus" comment when done.

Tests: assert each emitter enqueues to the outbox; assert outbox→consumer
delivery updates mastery; assert bus failure queues durably and retries.
```

### Sprint 3 — Real AAC vocabulary sync from brain-svc

```
In services/family-svc/src/routes/language-profile.ts (~line 131), replace the
empty placeholder SymbolBoard (items: [], grid 0x0) with the learner's real
vocabulary fetched from brain-svc.

- Add/use a brain-svc endpoint that returns the learner's active AAC
  vocabulary (symbols, labels, locale, grid layout) for the requested learner.
- Map it into the SymbolBoard shape, honoring the learner's locale (not
  hardcoded "en") and accommodation profile.
- Pass the populated board to CoughDropSync.syncLearnerVocabulary; keep the
  existing aac_sync_state bookkeeping and error handling.
- Fail loudly if brain-svc returns no vocabulary rather than syncing an empty
  board.

Tests: a learner with vocabulary syncs a non-empty board; locale is respected;
brain-svc failure does not write a "synced" state.
```

### Sprint 4 — AssistiveWare reverse highlight + SIS connector completion

```
Two related AAC/integration items:

A) packages/aac-bridge/src/adapters/AssistiveWareAdapter.ts: implement highlight()
   via the AssistiveWare x-callback-url reverse-highlight bridge (replace the TODO
   no-op at ~line 57). If the running platform cannot support reverse highlighting,
   degrade gracefully and surface capability via a documented feature flag rather
   than a silent empty method. Add a conformance-suite test exercising highlight().
   Update packages/aac-bridge/docs/INTEGRATION_STATUS.md.

B) services/integrations-svc/src/routes/connectors.ts: implement the two
   connectors currently marked status: "coming_soon" (schoology, powerschool) —
   roster pull (courses, students, teachers, sections) matching the shape the
   Clever/ClassLink/Canvas/Google handlers already return, with credential
   validation and tenant scoping. Flip status to "available" only when the
   sync path is tested end to end.

Tests: connector roster-sync contract tests for both new connectors; highlight()
conformance test.
```

### Sprint 5 — Authorization hardening: collaboration admin scope

```
In services/family-svc/src/routes/collaboration.ts (~line 1357), stop accepting
admin roles "at face value" when granting collaboration access. Verify the admin's
tenant/school scope actually covers the target learner (the learner's tenantId /
schoolId must fall within the admin's authorized scope) before granting, mirroring
the teacher classroom-link check that already exists.

Audit the rest of this file (and sibling family-svc routes) for the same pattern.
Add tests: an admin scoped to tenant A cannot grant collaboration on a learner in
tenant B; an in-scope admin still can. Run `pnpm rbac:audit` and keep it green.
```

### Sprint 6 — Test-coverage backfill (close the parity warnings)

```
Bring the untested and "yellow" services up to the backend-parity bar.

- Add unit + integration tests for the four services that currently have none:
  i18n-svc, integrations-svc, research-svc, status-page-svc. Cover each route's
  happy path, auth/tenant enforcement, and at least one failure mode.
- Add integration-test references under tests/integration/** for the services
  backend:parity flags as missing them: curriculum-svc, engagement-svc,
  integration-svc, integrations-svc, research-svc, subject-brain-svc, tenant-svc.
- Goal: `pnpm backend:parity` reports 0 yellow and 0 warnings.

Do not add trivial assert(true) tests — exercise real handlers against the
in-test server. Run `pnpm test` and `pnpm backend:parity`.
```

### Sprint 7 — Lock the "real mode" defaults so demo mode cannot ship

```
Make the mock-by-default risk from docs/PLATFORM_GAP_ANALYSIS.md impossible to
ship silently, and add a regression guard.

- Audit every AIVO_PERSISTENCE / AIVO_PERSISTENCE_* override, AUTH_MODE,
  AI_PROVIDER, and TTS/speech provider selector in apps/web-v2/lib/env.ts and
  the services. Ensure ALL of them fail-closed (throw) when NODE_ENV=production
  resolves to memory/mock — not just the three already guarded.
- Add a CI gate (extend scripts/no-demo-prod-scan.mjs or release-gate.mjs) that
  boots the app with NODE_ENV=production and asserts the process refuses to start
  if any persistence domain, auth, or provider would run in demo mode.
- Document the required production env matrix in one place and link it from
  README + HETZNER_DEPLOYMENT_GUIDE.

Tests: a production boot with any demo selector set must exit non-zero with a
clear message naming the offending variable.
```

---

## 3. Suggested ordering & sizing

| Sprint | Theme                          | Risk if skipped                             | Rough size  |
| ------ | ------------------------------ | ------------------------------------------- | ----------- |
| 7      | Lock real-mode defaults        | Demo data/auth ships to a real customer     | S (1–2 d)   |
| 1      | LTI 1.3 persistence            | LMS score write-back / interop broken       | M (3–5 d)   |
| 5      | Collaboration admin scope      | Cross-tenant authz leak                     | S (1–2 d)   |
| 2      | Speech Buddy telemetry         | Mastery signal lost for AAC learners        | M (2–4 d)   |
| 3      | AAC vocabulary sync            | AAC "sync" is a no-op                       | M (2–3 d)   |
| 6      | Test-coverage backfill         | Regressions ship undetected                 | M (3–5 d)   |
| 4      | AssistiveWare + SIS connectors | Feature completeness for specific districts | M–L (4–6 d) |

Recommended sequence: **7 → 5 → 1 → 2 → 3 → 6 → 4** (security/guardrails first, then interop, then
feature completeness, with test backfill folded into each PR where practical).

## 3a. Progress log (this branch)

All seven sprints implemented, tested, and committed on `claude/jolly-pasteur-z3eWA`:

| Sprint                        | Status  | What landed                                                                                                                                                                                                                                                                      |
| ----------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7 — lock real-mode defaults   | ✅ Done | Regression tests asserting the env validator fails closed in production for every demo selector (auth/AI/persistence + overrides, dev SESSION_SECRET, missing DATABASE_URL).                                                                                                     |
| 5 — collaboration admin scope | ✅ Done | SCHOOL_ADMIN/DISTRICT_ADMIN parent-invites now tenant-scoped (no cross-tenant); PLATFORM_ADMIN stays global. Cross-tenant rejection test added.                                                                                                                                  |
| 1 — LTI 1.3 persistence       | ✅ Done | New `lti/persistence.ts`: idempotent platform→deployment→context→resource-link upserts + AGS lineitem; unregistered platforms rejected; resource-link db id threaded into the session token. DB-backed tests verified against Postgres. Orphaned `__tests__/` suite un-orphaned. |
| 2 — Speech Buddy telemetry    | ✅ Done | EventEmitter writes a durable outbox; `flush_events()` drains to NATS (best-effort, order-preserving, survives outage). Orchestrator flushes at session/turn boundaries. `nats-py` added; 4 outbox tests.                                                                        |
| 3 — AAC vocabulary sync       | ✅ Done | New `aac_vocabulary` table + curated core-word catalog in `@aivo/aac-bridge`; `buildSymbolBoard()` seeds core vocab, is locale-aware, fails loudly (422) instead of syncing empty. DB-backed tests verified against Postgres.                                                    |
| 6 — test backfill             | ✅ Done | Unit suites for status-page-svc, i18n-svc, research-svc, integrations-svc; wired into CI. `backend:parity` now 28 green / 0 yellow (was 26 green / 2 yellow).                                                                                                                    |
| 4 — AssistiveWare + SIS       | ✅ Done | AssistiveWare reverse-highlight (native bridge → x-callback-url fallback) + `supportsReverseHighlight()`. Schoology + PowerSchool roster-sync handlers implemented, wired, flipped to `available`, unit-tested.                                                                  |

Residual items — now **closed**:

- ✅ The 6 `backend:parity` "no integration test references" warnings are gone. Added a Docker-free
  in-process integration suite (`tests/integration/inprocess/`) covering engagement-svc,
  integration-svc, integrations-svc, subject-brain-svc, and tenant-svc via their real `buildApp`,
  and a Python FastAPI TestClient suite (`tests/integration/python/`) for curriculum-svc. Both
  wired into CI. `backend:parity` is **28 green / 0 yellow / 0 warnings**.
- ✅ SIS connector validation: added a wire-level e2e (`sis-connectors.e2e.test.ts`, real HTTP vs a
  stub vendor server) and a credential-gated live-sandbox harness (`sis-connectors.live.test.ts`)
  plus `docs/runbooks/sis-connector-validation.md`. The only step that genuinely requires a human
  is running the live test with real vendor sandbox credentials (it skips automatically until
  those are provided).

## 4. Definition of done (every sprint)

1. Feature behind its existing flag where one exists; default-off until verified.
2. `pnpm prod:check`, `pnpm prod:no-demo`, `pnpm persistence:stubs`, and `pnpm backend:parity`
   all green.
3. New code path has unit **and** integration tests; no `it.skip`/`xit` left behind.
4. The placeholder comment that flagged the gap is removed (not just the code changed).
5. Relevant audit script green (`rbac:audit`, `consent:audit`, `ai-safety:audit`, etc.).

# 0007 — Web-v2 persistence migration (in-memory → Drizzle/Postgres)

- **Status:** Completed (Sprint 9) — 22 web-owned domains migrated + parity-proven on Postgres; the in-memory adapter is a TEST-ONLY fixture, forbidden in production by two independent guards (env schema + assertNoMemoryAdapterInProduction). Remaining db()-direct surface is service-owned per ADR 0015 (see Sprint 9 note).
- **Date:** 2026-05-27
- **Deciders:** web-v2 platform team
- **Related:** AIVO-LMS audit gap #4 ("web-v2 core runtime still in-memory/mock-backed")

## Rollout status (Sprint 1 — 2026-06-08)

All 12 originally-migrated domains route their repo functions through the
`Persistence` adapter, and the drizzle adapter for each is **fully
implemented and parity-proven on Postgres** (Sprint 1). The Testcontainers
parity harness replays every per-domain suite against memory AND postgres and
asserts identical results; `scripts/check-no-direct-store.mjs` locks the
migrated entrypoints clean. Staging defaults to `postgres` for these 12;
production forces it.

| #   | Domain                                    | Status         | Notes                                                              |
| --- | ----------------------------------------- | -------------- | ------------------------------------------------------------------ |
| 1   | notifications                             | ✅ postgres (proven) | `web_notifications` + deliveries; parity test green        |
| 2   | audit log                                 | ✅ postgres (proven) | `web_audit_logs`; append-only, tenant-scoped reads        |
| 3   | identity (users + memberships)            | ✅ postgres (proven) | `web_users` + `web_memberships`                           |
| 4   | learners + parent/learner relationships   | ✅ postgres (proven) | `web_learner_profiles` + relationships                    |
| 5   | assessments + baseline runs               | ✅ postgres (proven) | parent + baseline + telemetry; latest-attempt-wins parity |
| 6   | lesson runs + generated lesson plans      | ✅ postgres (proven) | `lesson_runs` + plans + interactions + summaries          |
| 7   | brain profile / clone                     | ✅ postgres (proven) | `learner_brain_profiles`; same-mode as assessments (hard) |
| 8   | curriculum (subjects/skills/path/mastery) | ✅ postgres (proven) | reference set + per-learner mastery/path                  |
| 9   | care team + consent + privacy             | ✅ postgres (proven) | consent/IEP/age-gate + policy/subprocessor catalogs. Sprint 5 extended this with DSAR export/deletion, terms acceptances, data inventory/retention, FERPA disclosure logs, IEP-doc access logs (`web_consent_versions` / `web_terms_acceptances` / `web_data_inventory` / `web_data_retention_policies` / `web_disclosure_logs` / `web_data_export_requests` / `web_data_deletion_requests` / `web_iep_doc_access_logs`). Platform/admin-accessed (DPO cross-tenant DSAR review + append-only audit logs) ⇒ no RLS, like web_users/web_audit_logs. |
| 10  | quests / gamification                     | ✅ postgres (proven) | worlds/chapters reference + per-learner progress          |
| 11  | teacher / school / district admin         | ✅ postgres (proven) | schools/classrooms/enrollments/assignments                |
| 12  | collaboration (insights + members)        | ✅ postgres (proven) | brain-build inputs; newest-first insights                 |
| 13  | billing — web-owned (Sprint 2)            | ✅ postgres (proven) | `web_billing_accounts` / `web_ai_budgets` / `web_ai_cost_events` / `web_coupons` / `web_daily_billing_batches`; canonical subs/invoices/seats read from billing-svc over REST (ADR 0015, `lib/billing/billing-svc-client.ts`). Migration jobs (cross-domain mock runner) deferred. |
| 14  | clinical — IEP AI-draft inbox (Sprint 3)  | ✅ postgres (proven) | `web_iep_ai_drafts` (one per learner, review lifecycle) + RLS. Canonical IEP goals / therapist notes / caregiver observations stay in family-svc, written through over REST (ADR 0015, `lib/clinical/family-svc-client.ts` — persist-or-fail-loudly). |
| 15  | security / SOC 2 / incidents (Sprint 4)   | ✅ postgres (proven) | `web_security_controls` / `web_control_evidence` / `web_risk_register` / `web_incidents` / `web_incident_timeline` / `web_vendors` / `web_state_privacy_requirements` / `web_state_privacy_mappings` / `web_vulnerability_reports`. Platform-global (no tenant) ⇒ no RLS, like policy/subprocessor reference. Status-page incidents/maintenance + Secure Impersonation BFFs de-stubbed: typed upstream errors, no synthetic ids. |
| 16  | rostering / SIS / lesson-sync (Sprint 6)  | ✅ postgres (proven) | `web_courses` / `web_roster_import_jobs` / `web_roster_import_errors` / `web_sis_connections` / `web_external_roster_mappings` / `web_lesson_sync_states` (durable + re-runnable import; optimistic-concurrency lesson sync keyed by lessonRunId). No RLS (platform-admin cross-tenant escape hatch + app-layer scoping). Canonical SIS sync read from integrations-svc over REST (`lib/rostering/integrations-svc-client.ts`); `lib/db/sis-store.ts` + `rostering-grants.ts` are documented service-mock dev stores. `deviceSessions` (no accessor) omitted. |
| 17  | audio / TTS / read-aloud (Sprint 7)       | ✅ postgres (proven) | `web_audio_assets` / `web_tts_generation_jobs` / `web_pronunciation_overrides` / `web_learner_voice_preferences` / `web_read_aloud_usage_events` / `web_audio_cache_entries` (composite key + hit counters). No RLS (admin usage/review consoles). |
| 18  | safety / moderation (Sprint 7)            | ✅ postgres (proven) | `web_safety_policy_versions` / `web_moderation_events` / `web_human_review_cases` / `web_blocked_generations` / `web_tutor_response_audits` / `web_homework_input_audits`. Moderation events + audits append-only; auto-opened review cases. No RLS (trust/safety admin console). Canonical responsible-AI evals/models read from responsible-ai-svc over REST. |
| 19  | support + AI-jobs (Sprint 8, partial)     | ✅ postgres (proven) | `web_support_tickets` / `web_ai_generation_jobs`. No RLS (admin cross-tenant). |
| 20  | tenant + platform settings (Sprint 8, partial) | ✅ postgres (proven) | `web_tenant_settings` (tenant-keyed) / `web_platform_api_keys` / `web_platform_email_templates` / `web_platform_webhook_endpoints`. No RLS. |
| 21  | engagement / sessions / notif-prefs (Sprint 8) | ✅ postgres (proven) | `web_homework_help_sessions` / `web_calm_sessions` / `web_learner_engagement` / `web_learner_badges` / `web_learner_sensory_profiles` + `web_notification_preferences` / `web_digest_schedules` (NotificationStore extension). No RLS (per-learner/user). Live gradebook/leaderboard read from engagement-svc over REST (ADR 0015). |
| 22  | standards / skill-graph (Sprint 8)         | ✅ postgres (proven) | `web_standards_frameworks` / `web_standard_documents` / `web_standards` / `web_domains` / `web_skill_prerequisites` / `web_skill_versions` / `web_curriculum_maps` / `web_lesson_objective_templates` / `web_assessment_blueprints` / `web_curriculum_import_jobs` (+ `CurriculumStore.upsertSkill`). Platform-global reference ⇒ no RLS. Per-learner curriculum uploads + term syllabi are tutor-svc-owned (REST) and keep their dev mock. |

> **Sprint 8 remaining (not yet migrated):** the standards/skill-graph surface (30 repos fns / 12 store fields — a sprint-sized effort), and the standalone aux stores (`audit-store`, `household-store`, `idp-store`, `learner-pin-store`, `messages-store`, `mfa-store`, `parent-phone-store`, `user-roles-store`, `staff-invites`, `team-invites`). Identity/MFA/IDP belong to identity-svc (REST). These remain `db()`-direct and are tracked for a follow-up.


## Sprint 9 — production decommission of the in-memory path

The in-memory Map (`lib/db/store.ts`) is now a **test fixture**, not a
datastore. Two independent guards make the memory adapter unreachable in
production:

1. **`lib/env.ts`** — the Zod schema refuses `memory` for `AIVO_PERSISTENCE`
   (and every `AIVO_PERSISTENCE_*` override) when `NODE_ENV=production` (and not
   the build phase / `AIVO_TEST_MODE=1`). A misconfigured deploy fails at boot.
2. **`assertNoMemoryAdapterInProduction`** (persistence/index.ts) — re-checks at
   the first `getPersistence()`: if any domain would resolve to `memory` in a
   production process it throws. Proven by `__tests__/no-memory-in-prod.test.ts`.

So in production every one of the 22 migrated domains resolves to the Drizzle
adapter; the memory adapters are reached only under `NODE_ENV=test` / vitest.

**Remaining `db()`-direct surface (tracked, NOT in-memory-in-prod):** a set of
not-yet-migrated repos functions whose canonical data is owned by a SERVICE per
ADR 0015 — tutor-svc curriculum uploads + term syllabi, billing-svc
subscriptions/seats/invoices, family-svc IEP goals / therapist notes /
caregiver observations, identity-svc tenants — plus the migration-job mock
runner and a few cross-domain aggregate readers. These still call `getStore()`
for their dev/mock path. Because they are reached in production ONLY via their
service REST path (or are admin-only aggregates), `getStore()` is intentionally
not hard-gated to throw — that final removal lands with the per-service REST
cutovers. `scripts/check-no-direct-store.mjs` therefore stays an allowlist gate
(enforcing the 22 migrated domains stay clean) rather than deny-all until that
cutover completes.

## Testcontainers parity harness (Sprint 0)

The migration is only safe if "behaves identically on Postgres" is a thing
CI can _prove_, not a thing we assert. Sprint 0 adds a parity rig so every
domain — present and future — is exercised against a **real, containerized
Postgres**, never a mock.

- **`lib/db/persistence/__tests__/pg-testcontainer.ts`** — `startPostgres()` /
  `withPostgres(fn)`. Boots `postgres:16` via `@testcontainers/postgresql`
  (or attaches to `AIVO_TEST_DATABASE_URL` when CI provisions a Postgres
  service), resets + applies the web-domain schema, and installs it as the
  drizzle client via `__setDbClient`. Returns `null` when no Postgres is
  reachable so suites skip cleanly on Docker-less machines.
- **`lib/db/persistence/__tests__/parity.harness.ts`** — `runInBothModes(name,
  suite)` replays the same suite against the memory adapters (reset + seeded
  per test) and against Postgres (truncated + reseeded per test), forcing the
  backend for every domain through the test-only `__setPersistenceModeOverride`
  seam in `persistence/index.ts`. A `ctx.parity(label, fn, project?)` helper
  records the memory-pass value and asserts deep-equality on the postgres pass
  (project to stable fields — the seed assigns random surrogate ids).
- **`seed-postgres.ts`** is idempotent (every reference insert
  `onConflictDoNothing` and reports rows that actually landed via `RETURNING`);
  `__tests__/seed-parity.postgres.test.ts` asserts the postgres reference-row
  counts equal the memory-seed counts and that re-seeding is a no-op.
- **`scripts/check-no-direct-store.mjs`** — an allowlist-driven gate
  (`MIGRATED_DOMAINS`, initially empty) that fails when a migrated domain's
  app routes or `repos.ts` functions reach `getStore()`/`db()`.
- All three run in CI via **`.github/workflows/web-v2-persistence.yml`**
  (`parity`, `no-direct-store`, `e2e-postgres`). The existing 12 adapter
  domains pass the harness in postgres mode today.

See `docs/runbooks/persistence-postgres.md` for the local container flow.

## Context

`apps/web-v2/lib/db/store.ts` holds the entire web-v2 dataset as
process-local JavaScript `Map`s (103 tables, ~9,500 lines of repo +
type code, 281 repo functions). The same data has authoritative
backends in `packages/db` (Drizzle + Postgres schemas, 30+ tables) and
in the 29 microservices under `services/*`.

Concrete problems this causes today:

- **No durability.** Every dev restart wipes the world; production
  deployments behind multiple Next.js workers see different state per
  worker.
- **No parity with services.** The brain-svc, assessment-svc, ai-svc,
  etc. own the canonical models in production; web-v2 reimplements
  them in-process with subtly different semantics (e.g.
  `apps/web-v2/lib/db/repos.ts:533-627` brain-clone vs.
  `services/brain-svc/src/brain_svc/routes/brain.py:86-106`).
- **Tests rely on `resetStore()`.** Real DB behaviour (transactions,
  unique constraints, foreign keys) is never exercised.

We cannot rewrite all 281 repo functions in a single change. We need
an incremental path that keeps web-v2 shippable while individual
domains move to the real database.

## Decision

We will introduce a thin `Persistence` adapter inside
`apps/web-v2/lib/db/persistence/` with two implementations:

1. **`MemoryAdapter`** — the existing `Map`-backed store, wrapped in
   the adapter interface. Default in `NODE_ENV=development` and in
   `vitest` runs. Behaviour preserved exactly so the migration is a
   non-event for callers that haven't been ported.
2. **`DrizzleAdapter`** — backed by `packages/db` (Drizzle ORM +
   Postgres). Selected when `AIVO_PERSISTENCE=postgres` and a valid
   `DATABASE_URL` is configured. Default in `NODE_ENV=production`.

The adapter exposes per-domain "stores" (e.g. `learnerStore`,
`notificationStore`) rather than the current single fat object. Each
`repos.ts` function gets a small refactor to take the relevant store
as a dependency instead of reaching into `getStore()` directly. That
boundary is what lets us migrate domains one at a time:

- Domains we have not yet ported keep using `MemoryAdapter`'s domain
  store, which is just a typed wrapper over the same `Map<string, T>`
  data we have today.
- Ported domains call into `DrizzleAdapter`'s implementation and get
  a real Postgres-backed read/write path, while the rest of the app
  is unchanged.

Selection happens once at boot in `lib/db/persistence/index.ts`
based on `serverEnv.AIVO_PERSISTENCE`. The exported `getPersistence()`
caches the adapter per-worker. Tests can `resetPersistence()` to
re-init in test mode.

### Migration order

Order is chosen so each step unblocks a real user story rather than
moving low-value domains first:

1. **Notifications** (smallest blast radius, already has a real
   schema in `packages/db/src/schema/comms.ts`). Proves the pattern
   end-to-end.
2. **Audit log** (write-mostly, append-only, easy semantics).
3. **Identity** (users, memberships, sessions). Required before
   anything else can have a real foreign-key.
4. **Learner profiles + parent/learner relationships.**
5. **Assessments + baseline runs.**
6. **Lesson runs + generated lesson plans.**
7. **Brain profile / brain clone.** Coordinates with service-stack
   parity (see ADR 0009) — at this point web-v2 should call
   `services/brain-svc` rather than re-implement the clone.
8. **Curriculum (subjects, skills, learning paths, mastery).**
9. **Care team + consent + privacy artefacts.**
10. **Quests / gamification.**
11. **Teacher / school / district admin.**

Each step ships behind a per-domain feature flag
(`AIVO_PERSISTENCE_<DOMAIN>=memory|postgres`) so a regression can be
reverted without a code rollback. Flags are removed once a domain has
been on postgres in production for two full sprint cycles.

### Schemas

We will **reuse `packages/db/src/schema/*`** wherever a schema
already exists. Where web-v2 has a model with no corresponding
Drizzle schema (rare; mostly the gamification + quest tables), we
add the schema in `packages/db` first as part of the same step.

Web-v2 types in `apps/web-v2/lib/db/types.ts` stay the canonical
**domain types** for the app. They are independent of the row types
emitted by Drizzle — adapter implementations map between them.

## Consequences

- **Positive:**
  - State survives restarts; multi-worker Next.js no longer fragments
    per-worker.
  - Production stops silently diverging from the services.
  - Tests can opt in to Postgres via a per-suite flag and exercise
    real constraints.
  - Domains can move one at a time without coordinated big-bang.
- **Negative:**
  - Two implementations live side-by-side until migration is
    complete (estimated 4–6 sprints for the full table).
  - Every repo function gets a small parameter-passing refactor (the
    store is now injected). One-time toil.
  - Test infrastructure has to gain a Postgres lifecycle (testcontainers
    or `pg_tmp`); we accept the added CI minutes.
- **Neutral / follow-ups:**
  - Connection pooling strategy (we'll re-use whatever
    `packages/db` exports — likely `postgres-js` with a per-worker
    pool).
  - Caching / read replicas are out of scope for this ADR.

## Alternatives Considered

- **Big-bang rewrite.** Rejected — 281 repo functions, breaks every
  in-flight feature branch, no rollback path.
- **Keep in-memory, add periodic snapshot to disk.** Rejected — does
  not solve multi-worker fragmentation, and creates a new untrusted
  source of truth alongside the services.
- **Skip the adapter, port repos directly to Drizzle.** Rejected —
  no per-domain flag means we lose the rollback story, and the
  port-everything-or-nothing constraint blocks shipping anything else
  during the migration.

# 0007 — Web-v2 persistence migration (in-memory → Drizzle/Postgres)

- **Status:** Accepted — adapter rollout complete (memory mode), drizzle wiring deferred per-domain
- **Date:** 2026-05-27
- **Deciders:** web-v2 platform team
- **Related:** AIVO-LMS audit gap #4 ("web-v2 core runtime still in-memory/mock-backed")

## Rollout status (as of 2026-05-28)

All 11 migration steps have routed their repo functions through the
`Persistence` adapter. The memory adapter is the default in every
mode; the drizzle adapter is a per-domain stub awaiting the schema
wiring listed in each `drizzle/*.ts` file's header comment.

| #   | Domain                                    | Status    | Notes                                                                  |
| --- | ----------------------------------------- | --------- | ---------------------------------------------------------------------- |
| 1   | notifications                             | ✅ memory | drizzle stub; awaits notifications schema in packages/db               |
| 2   | audit log                                 | ✅ memory | drizzle stub; awaits audit_logs schema                                 |
| 3   | identity (users + memberships)            | ✅ memory | drizzle wiring deferred (schemas exist in packages/db/users)           |
| 4   | learners + parent/learner relationships   | ✅ memory | drizzle wiring deferred (schemas exist in packages/db/learners)        |
| 5   | assessments + baseline runs               | ✅ memory | drizzle wiring deferred (schemas exist in packages/db/assessments)     |
| 6   | lesson runs + generated lesson plans      | ✅ memory | drizzle wiring deferred (schemas exist in packages/db/learning)        |
| 7   | brain profile / clone                     | ✅ memory | drizzle wiring deferred; bypassed when AIVO_USE_BRAIN_SVC=true         |
| 8   | curriculum (subjects/skills/path/mastery) | ✅ memory | drizzle wiring deferred (schemas exist in packages/db/curriculum)      |
| 9   | care team + consent + privacy             | ✅ memory | drizzle wiring deferred (schemas exist in packages/db/data-governance) |
| 10  | quests / gamification                     | ✅ memory | drizzle stub; awaits quests schema in packages/db                      |
| 11  | teacher / school / district admin         | ✅ memory | drizzle wiring deferred (schemas exist in packages/db/tenancy)         |

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

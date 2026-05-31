# ADR 0015: Web-domain persistence tables (`web_*`)

**Status:** Accepted

## Context

The `apps/web-v2` persistence layer (ADR 0007) abstracts each domain
behind a store interface with a memory and a Postgres adapter. When the
Postgres adapters were implemented, a question arose: should they write
to the **canonical operational tables** already owned by the
microservices (`learners`, `users`, `lesson_sessions`,
`gradebook_entries`, `brain_states`, …), or to their own tables?

The web app's domain objects do **not** map 1:1 to those canonical
tables. They are richer, web-shaped aggregates (e.g. `LearnerProfile`
with comfort/strengths/accessibility defaults, `LessonRun` with frozen
context/mastery/accommodation/brain snapshots, `LearnerBrainProfile`
lifecycle). The canonical tables are uuid-keyed, normalized, and owned
by services with their own write paths and invariants. Forcing the web
domain through them would either lose data or couple the web app to
service-internal schemas it does not control.

## Decision

The web persistence layer owns a dedicated set of **`web_*`** tables
(plus `lesson_runs`, `generated_lesson_plans`, `lesson_interactions`,
`lesson_parent_summaries`, `learner_brain_profiles`). They store the web
domain object verbatim in a JSONB `data` column, with typed columns only
for query predicates and ISO-8601 text timestamps. They are **distinct
from** the microservices' canonical tables and never written by services.

Where the web app needs live operational data that a service owns (e.g.
per-skill gradebook, lesson-session history), it reads the service's
**REST API** (e.g. `learning-svc /api/learning/gradebook/:learnerId`),
not the service's tables — preserving the service boundary. Mobile does
the same.

Reference data (subjects, skills, quest worlds, policy versions,
subprocessors) is seeded into `web_*` from the single in-memory seed
(`ensureSeeded()` via `seedPostgres`) so both modes match.

## Consequences

- **No lossy coupling**: the web app persists its full domain shape and
  is insulated from service-internal schema changes.
- **Two stores of record exist by design.** The web `web_*` tables and
  the services' canonical tables are independent; they are reconciled
  through service APIs (read) and the event bus (ADR 0003) where
  write-side consistency is required — not by shared tables.
- **Migrations** for `web_*` live in `packages/db` alongside the
  canonical schema and are applied by the same `db:migrate`.
- **RLS** (ADR 0002) is applied to the tenant-scoped `web_*` tables, so
  the new store of record gets the same database-enforced isolation.
- If a future requirement demands a single physical store across web +
  services, that is a separate, larger reconciliation — explicitly out
  of scope here.

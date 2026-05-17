# Problem Session Ledger

The problem session ledger is the canonical evidence store for every
interactive learner activity: baseline items, lesson beats, homework problems,
generated lesson tasks, scratchpad submissions, tutor interventions, hints,
answer attempts, and surface events. It is the spine that feeds the math
recognizer, science solver, profile recommendation engine, and audit service
in later sprints.

## Lifecycle

1. **Create**: a service (assessment-svc, learning-svc, tutor-svc/homework)
   calls `POST /api/problem-sessions` when the `problemSessionLedger` flag is
   on. The session inherits `tenantId`, `learnerId`, `subject`, and the
   originating `source` (`baseline`, `lesson`, `homework`, `tutor_chat`,
   `practice`).
2. **Append events**: every learner-visible moment emits a typed learning
   event (see `@aivo/events/learning-events`). Events use the shared schema
   `{ eventId, eventType, tenantId, learnerId, occurredAt, sourceService,
correlationId, payload }`.
3. **Append attempts**: each answer attempt is persisted with attempt number,
   correctness, score, latency, hint count, eraser count, and tool changes.
4. **Append snapshots**: scratchpad ink, diagram annotations, and final
   answer states are saved either inline as `snapshot_json` or via secured
   `storage_url`.
5. **Complete**: the session is marked `completed`. Summaries derived from
   attempts and events feed recommender and audit pipelines.

## Redaction

Free-form sensitive text is never written to analytics or audit fields. The
redactor (`problem-session-redaction.ts`) replaces the following with
`[redacted]` summaries when present in event payloads:

- `iepText`, `rawIepText`
- `parentPrivateNotes`, `parentNotes`
- `medicalNotes`, `medicalDiagnosis`
- `freeFormChat`, `learnerChat`
- `ocrText`, `uploadedOcrText`
- `rawText`

Raw learner work is preserved only inside `snapshot_json` or as a reference
to secured storage. Long strings outside that envelope are truncated to a
safe summary length.

## Schema

The Drizzle schema lives in `packages/db/src/schema/problem-sessions.ts` and
the corresponding additive migration is
`packages/db/migrations/enterprise_problem_sessions.sql`. Four tables:

- `problem_sessions` (one row per problem)
- `problem_session_events` (the immutable event log)
- `problem_session_surface_snapshots` (work captures)
- `problem_session_attempts` (per-attempt scoring metadata)

All four tables index by `tenant_id`, `learner_id`, and session id.

## Service API

```
POST   /api/problem-sessions
GET    /api/problem-sessions/:id
POST   /api/problem-sessions/:id/events
POST   /api/problem-sessions/:id/attempts
POST   /api/problem-sessions/:id/snapshots
POST   /api/problem-sessions/:id/complete
GET    /api/problem-sessions/learner/:learnerId/recent
```

The default backing store is an in-memory implementation conforming to
`ProblemSessionStore`. A Drizzle-backed implementation will land alongside
the audit and recommendation services that consume the ledger.

## Feature Flag

The ledger only records data when `AIVO_FEATURE_PROBLEM_SESSION_LEDGER=true`.
Adapter sites (assessment-svc baseline, learning-svc sessions, tutor-svc
homework) check the flag before contacting the service so the legacy code
path is unchanged when the flag is off.

## Adapter Contract

Adapters call `problem-session-svc` with the originating service noted in
`metadata.sourceService` and the relevant correlation id. The default
fetch-based adapter lives in
`services/problem-session-svc/src/services/problem-session-store.ts` (the
store interface) and can be wrapped by a thin HTTP client inside each
caller. Adapters must always swallow ledger errors without breaking the
parent flow: the ledger is _evidence_, not the source of truth.

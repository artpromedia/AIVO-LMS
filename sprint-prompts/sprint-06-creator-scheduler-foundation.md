# Sprint 06 — Creator: Day-of-Week Scheduler + Pre-Generation Foundation

## 1. Goal
After this sprint, a real **Sunday-night** scheduled job pre-generates each active learner's **next** lesson as a ready-to-play `LessonRun`, so when the learner opens their home the lesson is already generated (no wait, no on-demand stall). This delivers the missing "Creator + scheduler" foundation: a genuine day-of-week SafeCron job in a service that drives lesson generation through the existing web-v2 generator, plus the internal route that performs it. Sprint 07 extends this from "next lesson" to "the whole coming week" + parent visibility.

## 2. Context (no prior knowledge assumed)
The audit found no Creator agent and no Sunday scheduler; lessons are generated on demand. The verification pass established the exact architecture and three hard constraints:

1. **`@aivo/scheduling` is period-only** (`packages/scheduling/src/index.ts`): `startSafeCron(opts)` (`:133`), `isDue` (`:118-128`) checks only elapsed-≥-period — **no day-of-week**. Weekly jobs fake it with `periodMs: 7 * DEFAULT_PERIOD_MS`, which cannot pin "Sunday night." `JobOutcome` = `{ status:"ok"|"partial"|"failed"; sent?; failed?; walked?; ... }`. Ledger/lock backed by `daily_job_runs` + `periodic_job_runs` via `createDrizzleLedger`/`createDrizzleAdvisoryLock` (`packages/scheduling/src/drizzle-impl.ts`); **postgres-js rejects `Date` params — pass ISO strings**.
2. **The generator and mission-selection live in web-v2 and depend on web-v2-only state.** `generateLessonPlanWithRetry` (`apps/web-v2/lib/ai/tutor.ts:96`) and `createLessonRun` (`apps/web-v2/lib/db/repos.ts:1865`, input `{ learnerId, tenantId, subjectId, skillId, source, sourceRefId? }`) are web-v2 `@/`-aliased modules — **not importable from a service**. `pickTodaysMission` (`apps/web-v2/lib/learner/today.ts:82`) selects the next skill from the learner's learning path + mastery. **Do NOT re-implement these in a service** (it would fork the generator and silently diverge). The job must drive generation **inside web-v2** via an authenticated internal route.
3. **The resume seam already works:** a pre-generated run with `status: "ready"` is auto-picked-up — `pickTodaysMission` step 1 (`today.ts:90-96`) matches `status === "in_progress" || "ready"` and returns `existingRunId`; the start route `apps/web-v2/app/api/bff/learners/[learnerId]/today/start/route.ts:61-79` returns the existing run+plan with `resumed:true` instead of generating. `createLessonRun` already produces `status:"ready"` runs (`repos.ts:1977-1983`). **Caveat:** step-1 uses `.find()` (first match) — pre-generating multiple ready runs is non-deterministic; this sprint pre-generates ONE next run per learner (Sprint 07 handles multiple + deterministic ordering).

Existing patterns to copy:
- **Job registration:** `services/admin-svc/src/index.ts:131-191` constructs `lock`/`ledger` once and registers jobs (the pacing-advance wiring at `:165-171`), storing handles for the admin "Run now" route (`registerAdminInternalJobRoutes`, `:126`). The pacing-advance runner `services/admin-svc/src/lib/pacing-advance.ts` is the model for SQL-enumerating active pacing plans.
- **Internal service auth:** web-v2 BFF→service calls use `x-service-token: INTERNAL_SERVICE_TOKEN` (`apps/web-v2/lib/bff/tutor-agent.ts:22-30`). The reverse (service→web-v2 internal route) must use the same shared secret; `isPacingLive()`/`isLiveTutorAgent()` gate on `INTERNAL_SERVICE_TOKEN` presence.
- **Active learners:** `learners` (`packages/db/src/schema/learners.ts:16-43`) has **no `active` flag** — derive "active" from an `active` `learner_pacing_plans` row (`packages/db/src/schema/pacing.ts:80-118`, `status` default `"active"`) or recent `lesson_runs`. `services/engagement-svc/src/lib/weekly-rollup.ts:12` shows the SQL aggregation precedent.

## 3. Work orders

### DELETE
- Nothing removed.

### CREATE
- **Day-of-week scheduling in `@aivo/scheduling`** (`packages/scheduling/src/index.ts`): add an optional `schedule?: { dayOfWeek: 0-6; hour: number; minute?: number; tz?: string }` to `SafeCronOptions`. Extend `isDue` (or add `isDueAt`) so that when `schedule` is set, a run is due only when (a) now matches the target weekday/hour window AND (b) no run already happened in the current week. Keep period-based behavior when `schedule` is absent (backward compatible). Add unit tests for the new branch.
- **Internal web-v2 route** `apps/web-v2/app/api/internal/creator/pregenerate/route.ts` — POST, authenticated via `x-service-token` === `INTERNAL_SERVICE_TOKEN` (reject otherwise). Body `{ tenantId?, limit? }`. It enumerates active learners (via persistence; reuse the active-learner derivation), and for each: resolve the next mission with the SAME logic the learner home uses (call the production code path that picks the next subject/skill — `pickTodaysMission` or the persistence-backed selection it relies on), then `createLessonRun({ learnerId, tenantId, subjectId, skillId, source: "today_mission" })` **only if no `ready`/`in_progress` run already exists** for that learner (idempotent). Returns counts `{ generated, skipped, failed }`. Wrap each learner in try/catch so one failure doesn't abort the batch.
- **SafeCron job** in admin-svc: `services/admin-svc/src/lib/creator-weekly.ts` exporting `runCreatorWeeklyOnce(deps)` whose `run()` body does an authenticated `fetch` to the internal web-v2 route (`WEB_V2_INTERNAL_URL` + `x-service-token`) and maps the response to a `JobOutcome` (`sent`=generated, `failed`=failed). Register it in `services/admin-svc/src/index.ts` with `startSafeCron({ jobName: "creator.weekly-generation", schedule: { dayOfWeek: 0, hour: 23 }, ledger, lock, run })` and add its handle to the admin "Run now" map.
- Add `creator.weekly-generation` to `JOB_REGISTRY` (`packages/scheduling/src/index.ts:274-348`) with a description and the weekly period.

### REFACTOR
- If `pickTodaysMission` cannot run correctly outside a seeded request (it reads an in-memory Map store per the verification note), extract the **next-skill selection** into a persistence-backed function callable from the internal route (reuse the learning-path + mastery reads `createLessonRun`/`today.ts` already use through `getPersistence()`), so the Creator selects exactly what the learner home would. Do not duplicate logic — share it.

### EDIT
- `apps/web-v2/lib/env.ts` (and `.env.example`): add `INTERNAL_SERVICE_TOKEN` consumption for the inbound internal route if not already validated, and document `WEB_V2_INTERNAL_URL` for admin-svc.
- `services/admin-svc` config: add `WEB_V2_INTERNAL_URL` + `INTERNAL_SERVICE_TOKEN` to its env schema.

## 4. Implementation standard
- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## 5. Definition of done
- With `INTERNAL_SERVICE_TOKEN` + brain-svc available, trigger the job out-of-band (admin "Run now" → `triggerOnce()`); it calls the internal route, which pre-generates a `ready` `LessonRun` for each active learner who didn't already have one. Verify rows in `lesson_runs` (status `ready`, with a `generated_lesson_plans` row).
- Open a learner's home for whom a run was pre-generated → starting the lesson **resumes** the pre-generated run (`resumed:true` from `today/start`), with no generation latency.
- The day-of-week schedule: a unit test proves `isDue` returns true only inside the Sunday-night window and false otherwise; the same job does not double-run within a week.
- Idempotency: running the job twice does not create duplicate ready runs for the same learner.
- Internal route rejects requests without the valid `x-service-token`.
- Verification: `pnpm --filter @aivo/scheduling test && pnpm --filter @aivo/web-v2 build && pnpm --filter @aivo/admin-svc build && pnpm test`.

## 6. Tests
- `packages/scheduling`: unit tests for the new `schedule`/day-of-week due logic (Sunday-night true; other times false; once-per-week).
- web-v2: a test for the internal route — auth rejection, idempotent skip when a ready run exists, and a successful generate path (can use the memory persistence adapter in test mode).
- admin-svc: a test that `runCreatorWeeklyOnce` posts to the route and maps the response to a `JobOutcome`.
- Run `pnpm test` (full gate) so prior sprints stay green.

## 7. Out of scope
- Generating the **whole week** / multiple runs per learner, and the parent "next week" view — Sprint 07.
- Changing the on-demand generation path (it remains the fallback when no pre-generated run exists).
- Standard→skillId mapping from pacing weeks (Sprint 07 decides whether to use pacing-week skills or learning-path selection).

## 8. Depends on
- Sprint 05 (so pre-generated lessons use authored content) — soft but recommended. Sprint 02 (so they carry surfaces) — soft.

## 9. Checkpoint
Summarize the day-of-week scheduling addition, the internal route + auth, the admin-svc job wiring, and the active-learner derivation. Paste the `triggerOnce()` output showing generated/skipped counts and a DB snippet of the pre-generated ready runs. Pause; do not commit unless told to.

# Sprint 12 — Real Engagement Writes (XP/Streak) + Parent Snapshot Fix

## 1. Goal
After this sprint, completing a lesson **writes** real XP and updates the engagement streak, the learner home shows live (not seed-frozen) values, and the parent "snapshot" page shows real data (or is removed in favor of the already-real `progress`/`gradebook` pages). GAP-6 (the audit's Minor, cosmetic gap) is closed: the gamification surfaces stop being hardcoded.

## 2. Context (no prior knowledge assumed)
The audit found XP/level/streak read a real `LearnerEngagement` row but **nothing ever writes it** (seed-only), and the parent snapshot page is a static mockup. Verified:
- **EngagementStore has no write:** `apps/web-v2/lib/db/persistence/types.ts` — `EngagementStore` (`:160-166`) exposes `getEngagement` (and homework/calm session writers) but **no `upsertEngagement`/`awardXp`**. Drizzle impl `apps/web-v2/lib/db/persistence/drizzle/engagement.ts` only `select`s for `getEngagement` (`:59`). Memory impl alongside.
- **Schema exists:** `packages/db/src/schema/engagement.ts` — `streaks` table (`:46-60`, `currentStreak`/`longestStreak`/`streakTier`, unique per learner) and a `totalXp` column (`:199`). So persistence targets exist; they're just never written from lessons.
- **Completion is the write point:** `apps/web-v2/lib/db/repos.ts::completeLessonRun` (`:2308`) already, on completion, `upsertRun` + `applyOutcomeToMastery` (EWMA, `:2197-2214`) + mastery snapshots + parent summary. XP/streak writes belong here.
- **Home reads it already:** `apps/web-v2/app/learner/home/page.tsx:212` calls `getLearnerEngagement` (the comment at `:208-211` notes it should be "real streak/XP from engagement-svc-backed repo"). So once writes exist, the home reflects them with no UI change.
- **Snapshot mockup:** `apps/web-v2/app/parent/learners/[learnerId]/snapshot/page.tsx` — hardcoded `const learnerName = "Emma"` (`:23`), `value="2h 14m"` (`:50`), etc., with no data-layer calls. The real parent views are `apps/web-v2/app/parent/learners/[learnerId]/progress/page.tsx` and `.../gradebook/page.tsx`.

## 3. Work orders

### DELETE
- `apps/web-v2/app/parent/learners/[learnerId]/snapshot/page.tsx` — EITHER delete it and redirect its route to the real `progress` (or `gradebook`) page, OR fully rewrite it to read real data (see REFACTOR). Do not leave the hardcoded "Emma"/"2h 14m" mockup. (Recommended: redirect to `progress` unless the snapshot has a distinct, real purpose — decide and state which in the Checkpoint.)
- Remove any seed-derived XP synthesis that stands in for real values once real writes exist (e.g. the index-derived `totalXp` seed used by the home), so values come from real events.

### CREATE
- `apps/web-v2/lib/learner/engagement-award.ts` — exported `awardLessonEngagement(input: { learnerId, tenantId, outcome, completedAt }): Promise<EngagementUpdate>` that computes XP from the lesson outcome (checks correct, no-hint bonus, etc.) and updates the streak (increment on a new active day, reset on a gap, update tier), writing through the persistence adapter. Pure-ish + DB write; real logic, no placeholder numbers.

### REFACTOR
- `apps/web-v2/lib/db/persistence/types.ts`: add `upsertEngagement(...)`/`awardXp(...)` (and a streak upsert) to `EngagementStore`.
- `apps/web-v2/lib/db/persistence/drizzle/engagement.ts` and `.../memory/engagement.ts`: implement the new write methods against the `streaks` + XP tables (`packages/db/src/schema/engagement.ts`). Keep the memory/drizzle parity test green (`apps/web-v2/lib/db/persistence/__tests__/engagement.parity.test.ts`).

### EDIT
- `apps/web-v2/lib/db/repos.ts::completeLessonRun` (`:2308`): after mastery is applied, call `awardLessonEngagement(...)` (resilient — a failure logs and never fails completion, mirroring the existing snapshot try/catch). Make it idempotent with the existing "second call returns existing completed run" guard so XP isn't double-awarded.
- `apps/web-v2/app/learner/home/page.tsx`: confirm it renders the now-live engagement values (no change needed if it already reads `getLearnerEngagement`; remove any seed fallback).
- If a migration is needed (e.g. a `total_xp`/streak table not yet migrated), add one under `packages/db/drizzle/` following the existing numbered-migration convention.

## 4. Implementation standard
- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## 5. Definition of done
- Run the app: complete a lesson as a learner → XP increases by a real amount tied to the outcome, the streak updates, and the learner home reflects the new values on reload (not a frozen seed number). Complete a second lesson the same day → streak does not double-count the day; XP accrues.
- Idempotency: re-POSTing `/complete` for an already-completed run does not re-award XP.
- Parent snapshot route no longer shows "Emma"/"2h 14m" — it either redirects to the real `progress` page or shows real learner data.
- Memory/drizzle engagement parity test passes.
- Verification: `pnpm --filter @aivo/web-v2 build && pnpm --filter @aivo/web-v2 test && pnpm test`.

## 6. Tests
- Unit: `awardLessonEngagement` XP math + streak transitions (new day increments, gap resets, same-day no double-count).
- Persistence: extend `engagement.parity.test.ts` for the new write methods (memory == drizzle).
- Integration: `completeLessonRun` awards XP once and is idempotent on re-complete.
- A test (or removal) covering the snapshot route's new behavior (redirect or real data).
- `pnpm test` full gate green.

## 7. Out of scope
- Badges/leaderboards beyond XP + streak (separate feature).
- The `engagement-svc` weekly rollup job (already real; unaffected).
- Mobile engagement parity.

## 8. Depends on
- None. Independent of other sprints.

## 9. Checkpoint
Summarize the new engagement write methods, the XP/streak rules, the completeLessonRun wiring (idempotent + resilient), and the snapshot-page decision (redirect vs real data). Paste evidence of XP/streak updating after a completed lesson and the parity test passing. Pause; do not commit unless told to.

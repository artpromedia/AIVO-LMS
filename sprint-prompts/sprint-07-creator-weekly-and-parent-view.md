# Sprint 07 — Creator: Full Weekly Pre-Generation + Parent "Next Week" View

## 1. Goal
After this sprint, the Sunday-night Creator pre-generates the learner's **whole coming week** of lessons (one per enrolled subject/tutor, aligned to the learner's pacing week), a **parent "Next week" view** lists what's coming, the learner picks up the pre-generated lessons **deterministically** (no `.find()` ambiguity), and each pre-generated lesson is badged in the learner UI. GAP-3 ("every Sunday night each Creator generates the coming week's lessons for each learner") is fully closed.

## 2. Context (no prior knowledge assumed)
Sprint 06 built: day-of-week scheduling in `@aivo/scheduling`, the admin-svc `creator.weekly-generation` SafeCron job, and the internal web-v2 route `apps/web-v2/app/api/internal/creator/pregenerate/route.ts` that pre-generates ONE next `ready` run per active learner via `createLessonRun`. Reuse all of it.

Constraints/seams (verified):
- **Pacing weeks store free-text, not skillIds:** `learner_pacing_weeks` (`packages/db/src/schema/pacing.ts:120-147`) has `topics/standards/objectives/vocabulary` jsonb but **no `skillId` list** (`pacing-advance.ts:16-20` documents the missing standard→skill mapping). So "the week's lessons" must be enumerated from the learner's **learning path + enrolled subjects** (the same source `pickTodaysMission` uses), optionally themed by the pacing week's topics via the existing `curriculumFocus` that `createLessonRun` already injects (`repos.ts:1901-1905`).
- **Multiple ready runs need deterministic pickup:** `pickTodaysMission` step 1 (`apps/web-v2/lib/learner/today.ts:90-96`) uses `.find()` over ready/in-progress runs — non-deterministic with several pre-generated runs. Extend it to order deterministically (e.g. by subject priority, then `weekIndex`/`order`, then created-at) so the learner gets a sensible sequence.
- **Parent curriculum page:** `apps/web-v2/app/parent/learners/[learnerId]/curriculum/page.tsx` renders tabs via `<Tabs defaultValue="week">` (`:51`): "this_week" (`CurriculumManager`), "full_term" (`TermSyllabusManager`), "calendar" (`SchoolCalendarManager`), all from `@/components/curriculum/`. A "Next week" view is naturally a 4th tab or a panel that reads the learner's pre-generated `ready` runs.
- **List ready runs:** `listLessonRunsForLearner(..., { status: "ready" })` (`apps/web-v2/lib/db/repos.ts:2013`, persistence `listForLearner` supports `{ status }`, `apps/web-v2/lib/db/persistence/drizzle/lesson-runs.ts:119`).
- **Lesson-run sources:** `LessonRunSource` (`apps/web-v2/lib/db/types.ts:870-878`) includes `today_mission`, `subject_path`, `review`. Consider a dedicated source value (e.g. add `"weekly_creator"`) so pre-generated runs are auditable and the `lessonrun:audit` gate (`scripts/lessonrun-audit.mjs`) recognizes the creator path — verify that audit and update its allow-list if needed.

## 3. Work orders

### DELETE
- Nothing removed.

### CREATE
- `apps/web-v2/lib/learner/weekly-plan.ts` — exported `enumerateWeekSkills(learnerId, tenantId): Array<{ subjectId, skillId, dayIndex }>` that selects the coming week's lesson targets per enrolled subject from the learner's learning path + mastery (reuse the shared next-skill selection from Sprint 06), capped at a sensible per-week count, themed to the active pacing week's `curriculum_focus` where present. This is what the Creator iterates.
- `apps/web-v2/components/curriculum/next-week-panel.tsx` — a parent-facing component listing the learner's pre-generated `ready` runs for the coming week (subject, tutor, skill, day), reading via a BFF route. Real data only.
- BFF route `apps/web-v2/app/api/bff/parent/learners/[learnerId]/next-week/route.ts` — GET, parent-role + learner-scope guarded (mirror the existing parent BFF guards), returning the learner's `ready` runs joined to subject/skill/tutor metadata.

### REFACTOR
- `apps/web-v2/app/api/internal/creator/pregenerate/route.ts` (from Sprint 06): change from "next single run" to iterate `enumerateWeekSkills(...)` per active learner, generating a `ready` run per target (idempotent: skip targets that already have a ready/in-progress run), tagged `source: "weekly_creator"`. Keep per-learner and per-target try/catch and the counts response.
- `apps/web-v2/lib/learner/today.ts` `pickTodaysMission` step 1 (`:90-96`): replace `.find()` with a deterministic ordering over ready/in-progress runs so multiple pre-generated runs are consumed in a sensible sequence.

### EDIT
- `apps/web-v2/app/parent/learners/[learnerId]/curriculum/page.tsx`: add a "Next week" `TabsTrigger`/`TabsContent` mounting `<NextWeekPanel>` (translation key via the existing `getTranslations("curriculum.tabs")` pattern, `:26`).
- `apps/web-v2/app/learner/lesson-runs/[lessonRunId]/lesson-player.tsx` (or the learner home/lesson card): badge a `source === "weekly_creator"` run as "Planned for this week" (reuse the existing badge pattern, e.g. the `summer_bridge` pill around `:914`).
- `apps/web-v2/lib/db/types.ts`: add `"weekly_creator"` to `LessonRunSource` if you introduce it; update `scripts/lessonrun-audit.mjs` allow-list and any source-exhaustiveness switch.

## 4. Implementation standard
- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## 5. Definition of done
- Trigger the Sunday job (admin "Run now"): an active learner gets several `ready` runs (one per enrolled subject for the coming week), themed to their pacing focus where present; re-running is idempotent.
- Parent: open the learner's curriculum page → "Next week" tab lists the coming lessons with subject/tutor/skill. Real data, no placeholders.
- Learner: home/lesson list shows the pre-generated lessons badged "Planned for this week"; starting them resumes the pre-generated run deterministically (a predictable order across multiple ready runs).
- `pnpm lessonrun:audit` passes with the new `weekly_creator` source recognized.
- Verification: `pnpm --filter @aivo/web-v2 build && pnpm lessonrun:audit && pnpm test`.

## 6. Tests
- Unit: `enumerateWeekSkills` returns one target per enrolled subject, deduped, capped, and themed; `pickTodaysMission` ordering is deterministic given multiple ready runs.
- BFF: `next-week` route returns the learner's ready runs and enforces parent scope.
- e2e (Playwright): trigger pre-generation (or seed ready runs), assert the parent "Next week" tab lists them and the learner can play one (resumed). Reuse `setLearnerSession`/parent-session helpers.
- `pnpm test` full gate green.

## 7. Out of scope
- Building a true standard→skillId mapping from pacing standards (use learning-path selection themed by pacing focus; a deep standards→skill map is a separate curriculum effort).
- Notifications/emails about next week (can reuse comms-svc later; not required here).
- Mobile parity for the next-week view.

## 8. Depends on
- Sprint 06 (scheduler + internal route + day-of-week). Sprint 05 (authored content) and 02-04 (surfaces) recommended so pre-generated lessons are high-quality.

## 9. Checkpoint
Summarize `enumerateWeekSkills`, the deterministic pickup change, the parent "Next week" view, and the `weekly_creator` source + audit update. Paste the job output (multiple ready runs per learner), the parent view, and `lessonrun:audit` passing. Pause; do not commit unless told to.

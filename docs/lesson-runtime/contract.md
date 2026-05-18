# Lesson runtime contract (Sprint 07)

This document is the contract for baseline, mastery, LessonRun, Today's
Mission, and the tutor runtime. It is enforced by:

- `packages/adaptive-baseline` — the baseline runtime (1-PL adaptive,
  multimodal, deterministic when seeded)
- `packages/stage-runtime` — the lesson stage state machine
- `packages/stage-ui` — the lesson stage React surface
- `packages/tutor-runtime`, `packages/tutor-sdk`, `packages/tutor-surface-protocol`
- `apps/web-v2/lib/ai/tutor.ts` — generation orchestrator (retry +
  schema validation + deterministic safety-net fallback)
- `apps/web-v2/lib/db/types.ts` — `LessonRun`, `GeneratedLessonPlan`,
  `LessonInteraction`, `LessonRunStatus`, `LessonRunSource`,
  `LessonStepKind`, telemetry shape
- `scripts/lessonrun-audit.mjs` (root script `lessonrun:audit`)

## Baseline

| Property          | Contract                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Item construction | `BaselineItem` MUST carry `skillId` (curriculum-validate enforces no Item has empty `skillId`).                                                  |
| Generation        | Items come from `packages/item-bank` via `pickVariant(learnerId, itemId)` — deterministic per learner so retries are stable.                     |
| Selection         | Driven by learner θ + modality preferences + IEP-derived accommodations + reading-load flag. No hard-coded item lists.                           |
| Stopping rule     | Adaptive; stops when SE(θ) falls below threshold. A learner never sits through items they cannot answer.                                         |
| Output            | `LearningProfile` + grade-level placement. Grade level is a derived signal; the profile is the primary output.                                   |
| Score display     | Learners NEVER see a baseline score.                                                                                                             |
| Resumability      | If the player closes mid-baseline, `BaselineSession.status="in_progress"` is persisted and the next session resumes from the last answered item. |
| Consent gate      | Every `bff/learners/[learnerId]/baseline/*` route calls `requireLearnerConsent(["child_data_collection"])` (Sprint 04).                          |

## Mastery

| Property     | Contract                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Update       | After every lesson run + every baseline, mastery is recomputed per skill. The update is pure / synchronous / deterministic. |
| Snapshot     | `LessonMasterySnapshot` captures `score`, `level`, `confidence`, and `subjectContext` (siblings ordered by score asc).      |
| Surface      | Parent sees a plain-language summary, never the raw score. Teacher dashboards see the heatmap.                              |
| Consent gate | Every `bff/learners/[learnerId]/mastery/*` route calls `requireLearnerConsent(["child_data_collection"])` (Sprint 04).      |

## LessonRun

### Lifecycle

```
generating  →  ready  →  in_progress  →  completed
                  │            │
                  │            └── abandoned   (timeout / explicit leave)
                  └── failed                   (generation exhausted retries
                                                AND deterministic fallback
                                                also failed schema validation)
```

`generating → ready` only happens when `GeneratedLessonPlanSchema.parse()`
succeeds. A run cannot become `ready` with a malformed plan.

### Sources (`LessonRunSource`)

Every source maps to a real creator path. The audit script enforces
that for every source listed below, at least one BFF or
service-internal call site exists that emits a `LessonRun` with that
source.

| Source              | Creator                                                                     |
| ------------------- | --------------------------------------------------------------------------- |
| `today_mission`     | `/api/bff/learners/[learnerId]/today/start`                                 |
| `quest`             | `/api/bff/learners/[learnerId]/quests/[worldId]/chapters/[chapterId]/start` |
| `homework`          | `/api/bff/learners/[learnerId]/homework/[sessionId]/...`                    |
| `baseline_followup` | created internally by baseline completion                                   |
| `parent_assigned`   | `/api/bff/parent/.../assign` (Sprint 08)                                    |
| `teacher_assigned`  | `/api/bff/teacher/assignments/...`                                          |
| `review`            | scheduling-svc spaced-review job                                            |
| `subject_path`      | `/api/bff/learners/[learnerId]/subjects/[subjectId]`                        |

### Snapshots are frozen

`learnerContextSnapshot`, `masterySnapshot`, `accommodationSnapshot`,
and `brainStateSnapshot` are persisted at run-creation time. A
regenerate (retry) reuses the same snapshots so the lesson does not
drift if the brain profile is later edited.

### Generation

`apps/web-v2/lib/ai/tutor.ts::generateLessonPlanWithRetry`:

1. Calls the configured provider (Anthropic / OpenAI / Google /
   deterministic-mock in dev). `AUTH_MODE` and `AI_PROVIDER` are
   refused as `"mock"` in production (Sprint 03 env validator).
2. Validates the response against `GeneratedLessonPlanSchema`.
3. On schema mismatch or exception, retries up to
   `LESSON_PLAN_MAX_ATTEMPTS`.
4. **Safety-net fallback**: if every attempt fails, calls
   `generateDeterministicLessonPlan(input)` and tags telemetry with
   `provider: "mock"`, `model: "deterministic-fallback"`.

The safety net is intentional: a learner ALWAYS gets a usable plan.
But it is observable:

- `LessonRun.generation.provider === "mock"` AND
  `LessonRun.generation.model === "deterministic-fallback"` is a fault
  signal.
- Sprint 14's admin AI dashboard surfaces a "fallback rate" KPI and
  alerts at >2% over a rolling 1h window.
- The fallback plan must still satisfy `GeneratedLessonPlanSchema` —
  the orchestrator re-parses it with `.parse()` (not `.safeParse()`)
  so a regression in the deterministic generator throws.

### Resumability

`LessonRun` plus its `LessonInteraction[]` are the source of truth.
A page refresh during a lesson:

1. Reads `LessonRun` by id (BFF GET).
2. Replays `LessonInteraction` history.
3. Reseats the stage state machine via
   `@aivo/stage-runtime::SessionMachine` at the last
   `LessonStepKind`.

No client-side state, no localStorage truth, no "lost progress".

### Interactions

Every interaction is persisted with `LessonStepKind`:

`intro`, `story_hook`, `micro_lesson`, `example`, `guided_practice`,
`check` / `check_for_understanding`, `encouragement`, `celebrate`,
`progress_update`, `next_step`, `answer_submitted`, `hint_used`,
`scaffold_used`.

This is the audit trail for parent summaries, teacher recommendations,
mastery updates, and Sprint 14 AI safety review.

## Today's Mission

| Property        | Contract                                                                                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source-of-truth | Computed live from current mastery + prerequisites + teacher assignments + parent goals + learner fatigue/sensory signals.                                                        |
| No fabrication  | Today's Mission MUST NOT show fake progress. If no mission can be selected (e.g. learner just finished a chapter), surface an explicit empty state with a celebrate-and-rest CTA. |
| Cache           | Cached for 10 minutes per learner; invalidated by mastery update, new assignment, or parent goal change.                                                                          |
| Consent gate    | Every `bff/learners/[learnerId]/today/*` route calls `requireLearnerConsent(["child_data_collection","ai_personalization"])` (Sprint 04).                                         |

## Tutor runtime

| Property         | Contract                                                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persona          | Driven by `LessonRun.tutorPersona`, frozen at run creation.                                                                                                          |
| Surface protocol | Validated by `packages/tutor-surface-protocol::validators` — raw HTML/SVG are rejected; speech-required commands are gated by learner profile.                       |
| Cost / safety    | Sprint 14 wraps every generation in classification, prompt-injection detection, output policy validation, and per-tenant/per-learner/per-feature budget enforcement. |

## Parent summary

Every completed LessonRun produces a `lessonRunSummary` row:

- plain-language summary (no diagnostic labels)
- accommodations used in this run
- skill growth (delta in mastery score / level)
- next recommendation (path / quest / review)

Surfaced under `/parent/learners/[id]/lessons` and in the daily/weekly
parent summary email (Sprint 13).

## What the audit gate enforces

`scripts/lessonrun-audit.mjs`:

1. `LessonRunStatus`, `LessonRunSource`, `LessonStepKind` unions are
   parseable and non-empty.
2. Every `LessonRunSource` value has at least one referencing creator
   path in the BFF or service code.
3. The generation telemetry shape is intact in `lib/ai/tutor.ts`
   (provider, model, attempts, latencyMs, schemaVersion).
4. The deterministic fallback exists and is only invoked from
   `generateLessonPlanWithRetry` (no other callers reach for it).
5. The baseline package exports `BaselineItem` with a required
   `skillId`.

## Verification

```bash
pnpm lessonrun:audit
pnpm consent:audit             # learner BFF routes all carry consent
pnpm curriculum:validate       # every item has a real skillId
pnpm test --filter @aivo/adaptive-baseline
pnpm test --filter @aivo/stage-runtime
pnpm test --filter @aivo/web-v2 -- lib/ai/tutor
```

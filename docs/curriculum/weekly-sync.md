# Weekly curriculum sync (Phase 1)

Lets a parent or teacher tell AIVO what a learner is covering in school **this
week** so the AI tutor teaches the same topics — introducing the topic, showing
a worked example, and guiding the learner through it — fitted to the learner's
profile and accommodations.

This is Phase 1 of the broader "agentic, tutor-directed, school-aligned
learning" effort. It deliberately reuses infrastructure that already existed:

- the `ai-svc` syllabus parser (`POST /api/ai/curriculum/parse`)
- the structured lesson player (`GeneratedLessonPlan`: `microLesson` → `example`
  → `guidedPractice` → `checksForUnderstanding`)

## Flow

```
Parent/Teacher                Web BFF (web-v2)                 AI / generation
──────────────                ─────────────────                ───────────────
paste / upload  ──POST──▶  /curriculum/parse-preview ──▶ ai-svc /curriculum/parse
the week's plan            (no persistence)                (LLM extract, or
                                                            local heuristic fallback)
review & edit   ──POST──▶  /curriculum            ──▶ createCurriculumUpload
                                                       (status=active, archives prior)

later, a lesson starts ──▶ createLessonRun ──▶ getActiveCurriculumFocus
                                            ──▶ generateLessonPlanWithRetry({ curriculumFocus })
                                            ──▶ lesson anchored to the week's school topic
```

## Surfaces

- Parent: `/parent/learners/[learnerId]/curriculum`
- Teacher: `/teacher/learners/[learnerId]/curriculum`
- Shared client component: `components/curriculum/curriculum-manager.tsx`

## BFF routes

| Method | Route | Purpose |
| ------ | ----- | ------- |
| `GET`    | `/api/bff/{parent,teacher}/learners/:learnerId/curriculum` | list uploads |
| `POST`   | `/api/bff/{parent,teacher}/learners/:learnerId/curriculum/parse-preview` | parse without saving |
| `POST`   | `/api/bff/{parent,teacher}/learners/:learnerId/curriculum` | save an active focus |
| `DELETE` | `/api/bff/{parent,teacher}/learners/:learnerId/curriculum/:uploadId` | remove |

All routes go through `requireSession` + `requireRole` + `requireLearnerScope`.
The shared handlers live in `lib/bff/curriculum.ts`.

## Data

- Type: `CurriculumUpload` / `CurriculumFocus` (`lib/db/types.ts`), stored in the
  web-v2 store map `curriculumUploads`.
- `getActiveCurriculumFocus(learnerId, tenantId, subjectSlug)` picks the most
  recent active upload whose week window contains today (subject-specific wins
  over `other`); falls back to an undated active upload.
- Generation consumes it via `TutorGenerationInputs.curriculumFocus`
  (`lib/ai/tutor.ts`) → `generateDeterministicLessonPlan` (`lib/learner/lesson-plan.ts`),
  which anchors the title, intro/`microLesson`, story hook, worked example, and
  parent summary to the week's topic + vocabulary. When no focus exists the
  lesson generates exactly as before.

## Parsing

`lib/learner/curriculum-parse.ts` calls `ai-svc` with the shared
`INTERNAL_AI_TOKEN` (`X-Internal-Auth`). When the token is unset or the call
fails it degrades to a deterministic local heuristic (topic lines + standard
codes), so the upload flow always works; the human reviews/edits before saving.

Env (web-v2): `AI_SVC_URL` (default `http://localhost:3004`), `INTERNAL_AI_TOKEN`
(same shared secret used by tutor-svc / ai-svc).

## Tests

`lib/learner/curriculum-sync.test.ts` covers the parser heuristic, the
edited-focus sanitizer, and the lesson generator anchoring to the school topic
(routed through the sanctioned `generateLessonPlanWithRetry` orchestrator so the
`lessonrun:audit` contract stays intact).

## Not in this phase

School calendar + dated week-by-week pacing, persisting the AI scope-&-sequence
as a weekly plan, the `weekly_curriculum` Today's Mission source, and holiday/
break prep — see the gap analysis (Phases 2–4).

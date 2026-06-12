# Sprint 02 — Domain Surface Contract + Math Number Line (e2e)

## 1. Goal
After this sprint, the lesson-plan contract carries an optional, **validated** per-item `surface`, both lesson generators (deterministic + LLM) emit a domain surface keyed off the tutor/subject, and the production lesson player **mounts** it. The first domain surface ships end-to-end: a **math** lesson renders an interactive **number line** (content-derived, not a hardcoded 0-10 fixture), the learner answers on it, and the answer is scored and persisted exactly like today's choice/text answers. Non-math lessons continue to render the generic `choice_grid`/`math_expression`. This establishes the contract + player wiring that Sprints 03-04 reuse for every other domain.

## 2. Context (no prior knowledge assumed)
Today every tutor renders a generic surface because the `.strict()` `GeneratedLessonPlanSchema` has no `surface` field on practice items, neither generator emits one, and the player falls back to `?? choice_grid/math_expression`. A 16-surface component library already exists and is fully wired into a `SurfaceRouter`, but is only reachable from a prod-disabled fixture page.

Key files & seams (all verified):
- **Contract:** `apps/web-v2/lib/validators/lesson.ts` — `GeneratedLessonPlanSchema` is `z.object({...}).strict()` (`.strict()` at `:157`). The `guidedPractice` item object is `:124-133`; `checksForUnderstanding` item is `:138-145`. `LessonMediaPayloadSchema` (`:68-104`) is the existing precedent for an optional structured sub-object on an item. Because of `.strict()`, a new field MUST be declared here or parsing throws.
- **DB type:** `apps/web-v2/lib/db/types.ts` — `GeneratedLessonPlan` (`:930-1088`); the guided item has a vestigial untyped `surfaceType?: string` (`:953`) and the check item at `:974`. Replace/augment with a typed `surface?`.
- **Deterministic generator:** `apps/web-v2/lib/learner/lesson-plan.ts` — `generateDeterministicLessonPlan` (`:239-424`); per-subject builders `readingPractice` (`:82-134`), `mathPractice` (`:136-187`), `genericPractice` (`:189-209`); branch select at `:262-269`; the single funnel where every guided item is finalized is the `.map` at `:270` (`const guidedPractice = guidedRaw.map((g) => ({ ...g, skillId: skill.id }))`) — **this is the attach point**. Subject/tutor resolved via `getSubjectBySlug(subject.slug)?.tutorKey` and `TUTORS` from `@aivo/brand` (imported at `:20`).
- **LLM provider:** `apps/web-v2/lib/ai/anthropic-tutor.ts` — `SYSTEM_PROMPT` (`:29-44`) and `buildUserPrompt` (`:46-65`) anchor Claude to the deterministic plan passed as `example`. The provider does NOT self-validate; the caller `generateLessonPlanWithRetry` (`apps/web-v2/lib/ai/tutor.ts:96`) runs `GeneratedLessonPlanSchema.parse`. So once `surface` is in the schema and the deterministic example carries it, the LLM is anchored to it for free; add a one-line system-prompt nudge for surface selection.
- **Player:** `apps/web-v2/app/learner/lesson-runs/[lessonRunId]/lesson-player.tsx` — the `surfaceType` resolver is at `:136-138` (guided) and `:153-155` (check): `surfaceType: (g as { surfaceType?: ... }).surfaceType ?? (g.choices?.length ? "choice_grid" : "math_expression")`. `buildBeats` (`:116`+) builds beats from the plan. `toSurfaceItem` (`:635-773`) builds the flat `SurfaceRouterItem`; the **number_line branch is a hardcoded fixture** `{ min: 0, max: 10, step: 1 }` at `:672-679` — replace with content-derived values. `SurfaceRouter` is rendered for guided (`:1005-1010`) and check (`:1056-1061`) beats; `submitSurface` (`:775-813`) handles scoring/advance.
- **Surface library:** `packages/learner-surfaces` (`@aivo/learner-surfaces`). `SurfaceRouterItem` (`SurfaceRouter/SurfaceRouter.tsx:41-69`) carries `surfaceType` + per-surface sub-spec fields (e.g. `numberLine?: NumberLineSpec`). `NumberLineSpec` = `{ min: number; max: number; step: number }` (`types.ts:387-391`). `toRuntimeSurfaceType` (`SurfaceRouter/surface-type-map.ts:100-105`) passes `"number_line"` through unchanged. `NumberLineSurface` exposes `aria-label="number-line-surface"` and a `submit number line` button (per `apps/web-v2/e2e/lesson-player-number-line.playwright.ts`).
- **Subject→tutor:** `nova` ↔ subject slug `math` (`packages/brand`: `LEARNER_SUBJECTS`, `getSubjectBySlug`, `TUTORS`).

## 3. Work orders

### DELETE
- Remove the vestigial untyped `surfaceType?: string` on the guided item (`apps/web-v2/lib/db/types.ts:953`) and check item (`:974`) ONLY after replacing all readers — i.e. delete it as part of the EDIT that introduces the typed `surface?`. Do not leave both.

### CREATE
- `apps/web-v2/lib/learner/surface-selection.ts` — exported `selectSurfaceForItem(input: { tutorKey, subjectSlug, skillId, item })` returning a typed `LessonSurface` (the new schema sub-object) or `undefined`. For Sprint 02 it returns a `number_line` surface for `tutorKey === "nova"` (math) on numeric items, deriving `{ min, max, step }` from the item's `expectedAnswer`/`choices` (e.g. span a range that includes the answer and plausible options; never the hardcoded 0-10). Returns `undefined` (→ generic surface) for all other tutors this sprint. This is the single place Sprints 03-04 extend.
- Define the shared `LessonSurface` Zod schema + TS type in `apps/web-v2/lib/validators/lesson.ts` (a discriminated union on `surfaceType`, starting with `number_line` carrying `{ surfaceType: "number_line", numberLine: { min, max, step } }`). Sprints 03-04 add variants.

### REFACTOR
- `apps/web-v2/lib/learner/lesson-plan.ts`: at the `.map` funnel (`:270`), call `selectSurfaceForItem(...)` and attach `surface` to each guided item (and, where appropriate, the `checksForUnderstanding` items built at `:295-308`). Keep behavior identical when `selectSurfaceForItem` returns `undefined`.

### EDIT
- `apps/web-v2/lib/validators/lesson.ts`: add the optional validated `surface` field to BOTH the `guidedPractice` item object (`:124-133`) and the `checksForUnderstanding` item object (`:138-145`), referencing the new `LessonSurface` schema. Keep `.strict()`. Update `GeneratedLessonPlanInput` consumers as needed.
- `apps/web-v2/lib/db/types.ts`: replace the vestigial `surfaceType?: string` (`:953`, `:974`) with `surface?: LessonSurface` (typed), matching the schema.
- `apps/web-v2/app/learner/lesson-runs/[lessonRunId]/lesson-player.tsx`:
  - Update the resolver at `:136-138` and `:153-155` to read the new `surface` object (use `g.surface?.surfaceType ?? (g.choices?.length ? "choice_grid" : "math_expression")`), and forward the whole `surface` sub-spec onto the `Beat` so `toSurfaceItem` can read it.
  - In `toSurfaceItem`, replace the hardcoded number_line fixture (`:672-679`) with the content-derived spec read off `beat.surface.numberLine`. Leave the other hardcoded fixtures untouched this sprint (Sprints 03-04 replace them).
- `apps/web-v2/lib/ai/anthropic-tutor.ts`: add one instruction to `SYSTEM_PROMPT` (`:29-44`): when the reference example includes a `surface` object on an item, reproduce it with the same `surfaceType` and a sensible content-appropriate sub-spec (do not invent unknown surface types). No other provider change is needed — anchoring does the rest.

## 4. Implementation standard
- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## 5. Definition of done
- A real (non-fixture) math lesson renders an interactive number line. Verify by running the app and playing a math lesson, OR by the e2e below.
- Run the app: `pnpm --filter @aivo/web-v2 dev` (or the repo's documented start). As a learner, start a **math** lesson from the learner home; a guided beat shows the number-line surface (`aria-label="number-line-surface"`) with a content-appropriate range (NOT 0-10 unless the content warrants it); selecting the correct point and submitting advances and scores correctly. Start a **reading** lesson → it still shows the generic choice/text surface.
- `GeneratedLessonPlanSchema.parse` accepts a plan whose math items carry `surface` and still rejects unknown keys (strictness preserved).
- The deterministic fallback (AI off) produces a math plan with a number-line surface — verify with `AI_PROVIDER` unset/mock in dev.
- Verification commands: `pnpm --filter @aivo/web-v2 build`, `pnpm --filter @aivo/learner-surfaces build`, and the e2e in §6.

## 6. Tests
- Update `apps/web-v2/lib/learner/__tests__/` (or create) a unit test: `generateDeterministicLessonPlan` for a math subject yields guided items with `surface.surfaceType === "number_line"` and a range covering the expected answer; a reading subject yields no `surface`.
- Add a production-path e2e following the existing pattern in `apps/web-v2/e2e/lesson-player-number-line.playwright.ts` and `lesson-player-surfaces.helpers.ts`, but driving a **real lesson run** (not `lesson-player-fixture`, which is prod-disabled). Assert the number-line surface renders and a correct submit advances. Reuse the `setLearnerSession` cookie helper.
- Add a schema test (`apps/web-v2/lib/validators/__tests__/lesson.*`) asserting the `surface` field validates `number_line` and rejects malformed specs.
- Run `pnpm test` and `pnpm --filter @aivo/web-v2 test` so prior sprints stay green.

## 7. Out of scope
- Do NOT wire surfaces for any tutor other than nova/math (Sprints 03-04 do reading, science, coding, art, music, voice, etc.).
- Do NOT replace the other hardcoded fixtures in `toSurfaceItem` yet (geometry/coding/art/voice/science/etc.).
- Do NOT change how lesson CONTENT (prompts/answers) is sourced — that is Sprint 05. This sprint only adds the surface envelope around existing content.
- Do NOT touch the agent/`present_surface` path.

## 8. Depends on
- None hard. Recommended after Sprint 01.

## 9. Checkpoint
Summarize: the new `LessonSurface` schema shape, the `selectSurfaceForItem` mapping (nova→number_line only this sprint), the player edits, and how the number-line range is derived from content. Paste the passing e2e output and a screenshot or description of a math lesson rendering the number line. Pause for review; do not commit unless told to.

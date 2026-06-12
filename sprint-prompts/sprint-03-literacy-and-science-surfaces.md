# Sprint 03 — Literacy & Science Surfaces (e2e)

## 1. Goal
After this sprint, **reading/writing** lessons (Sage) render a **reading-annotation** surface (highlight/underline evidence in a passage) and **science** lessons (Spark) render a **labeled science diagram** (and/or a **graph** for quantitative skills) — both mounted by the real lesson player, content-derived, scored, and persisted. This extends the surface contract built in Sprint 02 to two more domains.

## 2. Context (no prior knowledge assumed)
Sprint 02 added a validated `surface` field to `GeneratedLessonPlanSchema` (`apps/web-v2/lib/validators/lesson.ts`), a `selectSurfaceForItem` resolver (`apps/web-v2/lib/learner/surface-selection.ts`), generator emission at the `.map` funnel (`apps/web-v2/lib/learner/lesson-plan.ts:270`), and player wiring (resolver `:136-155`, `toSurfaceItem` `:635-773`, render `:1005-1010`/`:1056-1061`). Reuse all of it.

Surface specs (verified, `packages/learner-surfaces/src/types.ts`):
- `ReadingAnnotationSpec` (`:102-123`): `{ passage: ReadingAnnotationSpan[]; tools?: ("highlight"|"underline")[]; expectedEvidenceIds?; question? }`, span = `{ id, text, selectable?, breakAfter? }`. Component `ReadingAnnotationSurface` (`surfaces/ReadingAnnotationSurface.tsx`).
- `ScienceDiagramSpec` (`:223-231`): `{ targets: { id, x, y, correctLabelId? }[]; labels: { id, text }[]; diagram?: GeometryDiagramSpec; width?; height? }`. Component `ScienceDiagramSurface`.
- `GraphSpec` (`:134-146`): `{ xMin, xMax, yMin, yMax, step?, mode?: "points"|"line", expectedPoints?, tolerance? }`. Component `GraphSurface`.

**Important (verified):** in the player's `toSurfaceItem`, `reading_annotation` (`:691-704`), `science_diagram` (`:741-762`), and `graph` (`:705-715`) **already read an authored spec off the beat** (`currentBeat.<spec> ?? <hardcoded default>`). So once the generator emits `surface.readingAnnotation` / `surface.scienceDiagram` / `surface.graph` and `buildBeats` forwards it onto the beat, these become content-driven by removing the hardcoded default fallback. Less player surgery than Sprint 02's number_line.

Subject→tutor (`packages/brand`): `sage` ↔ slugs `reading`, `writing`; `spark` ↔ slug `science`. Surface aria-labels follow the `<surface>-surface` convention; check the component files for exact labels (e.g. `reading-annotation-surface`, `science-diagram-surface`).

## 3. Work orders

### DELETE
- In `apps/web-v2/app/learner/lesson-runs/[lessonRunId]/lesson-player.tsx::toSurfaceItem`, remove the hardcoded default fixtures for `reading_annotation` (`:691-704`, the fox/stream passage) and `science_diagram` (`:741-762`, the cell/nucleus default) and `graph` (`:705-715`) — replace each with a read from `beat.surface.<spec>` (no fixture fallback; if absent, the surface should not be selected because the resolver wouldn't have chosen it).

### CREATE
- Add reading/science spec builders to `apps/web-v2/lib/learner/surface-selection.ts`: extend `selectSurfaceForItem` to return `reading_annotation` for `tutorKey === "sage"` (build a `passage` from the item prompt/passage text, marking selectable spans + `expectedEvidenceIds` from the expected answer) and `science_diagram`/`graph` for `tutorKey === "spark"` (diagram for labeling skills, graph for quantitative skills — choose by skill/prompt heuristic). Add the corresponding `LessonSurface` Zod variants to `apps/web-v2/lib/validators/lesson.ts`.

### REFACTOR
- `apps/web-v2/lib/learner/lesson-plan.ts`: where reading items are built (`readingPractice`, `:82-134`) ensure the generated guided/check items carry enough text for a meaningful passage; where science items are built (`genericPractice` path is used for science today — see Sprint 05 for real content) ensure the surface builder has the fields it needs. Keep generic fallback when the resolver returns `undefined`.

### EDIT
- `apps/web-v2/app/learner/lesson-runs/[lessonRunId]/lesson-player.tsx`: ensure `buildBeats` forwards `surface.readingAnnotation`/`surface.scienceDiagram`/`surface.graph` onto the beat so `toSurfaceItem` reads them. Update the `surfaceType` resolver (`:136-155`) — already reads `g.surface?.surfaceType` after Sprint 02 — to cover the new types.
- `apps/web-v2/lib/ai/anthropic-tutor.ts`: the system-prompt surface note from Sprint 02 already instructs the model to reproduce `surface`; no change unless reading/science examples need an extra hint — add one line if the model under-produces passages.

## 4. Implementation standard
- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## 5. Definition of done
- Run the app; play a **reading** lesson → a reading-annotation surface renders with the lesson's actual passage; highlighting the correct evidence and submitting scores/advances. Play a **science** lesson → a labeled diagram (or graph) renders from content; placing labels correctly advances.
- No hardcoded fox/stream or cell/nucleus fixture appears in any real lesson (grep the player to confirm the defaults were removed).
- Deterministic fallback (AI off) produces these surfaces for reading/science.
- Verification: `pnpm --filter @aivo/web-v2 build` + the e2e in §6.

## 6. Tests
- Unit: `selectSurfaceForItem` returns `reading_annotation` for sage and `science_diagram`/`graph` for spark with content-derived specs.
- Production-path e2e (pattern from `apps/web-v2/e2e/lesson-player-surfaces.helpers.ts`): a real reading lesson asserts `reading-annotation-surface` renders; a real science lesson asserts `science-diagram-surface` (or graph) renders, each with a correct-submit advance.
- `pnpm test` + `pnpm --filter @aivo/web-v2 test` green.

## 7. Out of scope
- Coding/art/music/voice and remaining-tutor mapping (Sprint 04).
- Content authoring / sourcing (Sprint 05, 08-09).
- Changing scoring semantics.

## 8. Depends on
- Sprint 02 (surface contract + player wiring + `selectSurfaceForItem`).

## 9. Checkpoint
Summarize the new `selectSurfaceForItem` branches and the removed fixtures, paste passing e2e output, and describe a reading + a science lesson rendering their surfaces. Pause; do not commit unless told to.

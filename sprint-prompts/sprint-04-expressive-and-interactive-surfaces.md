# Sprint 04 — Expressive & Interactive Surfaces (completes GAP-1)

## 1. Goal
After this sprint, **every one of the 14 tutors** maps to a domain-appropriate learning surface in the real lesson player. This sprint wires the remaining domain surfaces — **coding sandbox** (Pixel), **art canvas** (Muse), **music sequencer** (Cadence), **voice response** (Echo, Lingua), **drag manipulative / multi-step** (Nova manipulatives, Compass exec-function) — and assigns a justified surface to the remaining tutors (Chrono, Atlas, Harmony, Vigor, Forge). GAP-1 ("math vs. reading should not share one generic surface") is fully closed: a math, reading, coding, music, speech, and art lesson each render visibly different, domain-appropriate interactions.

## 2. Context (no prior knowledge assumed)
Sprints 02-03 built the `surface` contract (`apps/web-v2/lib/validators/lesson.ts`), the `selectSurfaceForItem` resolver (`apps/web-v2/lib/learner/surface-selection.ts`), generator emission (`apps/web-v2/lib/learner/lesson-plan.ts:270`), and player wiring (`apps/web-v2/app/learner/lesson-runs/[lessonRunId]/lesson-player.tsx`). Reuse them.

Surface specs (`packages/learner-surfaces/src/types.ts`) and components (`packages/learner-surfaces/src/surfaces/`):
- `CodingSandboxSpec` (`:318-343`): `{ language; starterCode?; correctness?: { type:"coding", language, starterCode, tests }; prelude?; hint? }` → `CodingSandboxSurface`. **Player fixture to replace:** hardcoded `{ language:"javascript", starterCode:"// write your solution\n" }` at `lesson-player.tsx:680-683`.
- `ArtCanvasSpec` (`:366-379`, all optional) → `ArtCanvasSurface`. Fixture at `:684`.
- `MusicSequencerSpec` (`:77-86`): `{ tracks: string[]; steps?; tempo?; expectedPattern?: number[][] }` → `MusicSequencerSurface`. Reads off beat already (`:763-771`).
- `VoiceResponseSpec` (`:348-360`): `{ language; targetText?; maxDurationSeconds?; scoreServiceUrl? }` → `VoiceResponseSurface`. Fixture at `:685-686`. (Echo also has a dedicated Speech Buddy path; here we only need the in-lesson voice surface.)
- `DragManipulativeSpec` (`:169-174`) and `MultiStepSpec` (`:194-196`) → `DragManipulativeSurface` / `MultiStepWorkspaceSurface`. Read off beat already (`:716-740`).
- `GeometryDiagramSpec` (`:423-432`) → `GeometrySurface`. Fixture at `:661-671`.

Premium-surface→tutor pins already exist in `packages/learner-surfaces/src/entitlement/required-tutor.ts:43-56` (`coding_sandbox→pixel`, `art_canvas→muse`, `voice_response→[echo,lingua]`, `music_sequencer→cadence`) — align the mapping with these. `SURFACE_CAPABILITY_REGISTRY` notes (`SurfaceRouter/surface-capability.ts:41-67`) corroborate the intent.

Subject→tutor (`packages/brand`): pixel↔`coding`, muse↔`art`, cadence↔`music`, echo↔`speech`, lingua↔`world-languages`, compass↔`executive-function`/`life`, nova↔`math` (manipulatives for early grades), chrono↔`social-studies`, atlas↔`geography`, harmony↔`social`, vigor↔`physical-education`, forge↔`engineering`.

**Remaining-tutor mapping decision (document it):** assign each of chrono/atlas/harmony/vigor/forge a domain-appropriate surface from the existing 16 (e.g. `reading_annotation` for source-analysis in chrono/atlas, `drag_manipulative`/`multi_step_workspace` for sequencing/process in harmony/vigor/forge, `science_diagram`/`graph` where quantitative). Only fall back to `choice_grid` where no richer surface is genuinely appropriate, and justify it in the Checkpoint — the spec's bar is "not ONE generic surface for all," not "a bespoke widget for every micro-skill."

## 3. Work orders

### DELETE
- In `lesson-player.tsx::toSurfaceItem`, remove the remaining hardcoded fixtures and replace each with a read off `beat.surface.<spec>`: geometry (`:661-671`), coding (`:680-683`), art (`:684`), voice (`:685-686`). (Music/drag/multi-step already read off the beat — just drop their hardcoded default fallbacks.)

### CREATE
- Extend `apps/web-v2/lib/learner/surface-selection.ts` `selectSurfaceForItem` with branches for pixel→`coding_sandbox` (derive `language` from skill/grade, build `tests` from expected output where present), muse→`art_canvas`, cadence→`music_sequencer` (derive `tracks`/`expectedPattern` from content), echo/lingua→`voice_response` (set `language`, `targetText` from prompt), nova(early)→`drag_manipulative` for manipulative skills, compass→`multi_step_workspace`/`drag_manipulative`, and the justified mappings for chrono/atlas/harmony/vigor/forge.
- Add the corresponding `LessonSurface` Zod variants in `apps/web-v2/lib/validators/lesson.ts` for every new `surfaceType` used.

### REFACTOR
- `apps/web-v2/lib/learner/lesson-plan.ts`: ensure the generator provides the fields each new surface needs (e.g. coding expected output, music pattern). Keep generic fallback only where `selectSurfaceForItem` returns `undefined`.

### EDIT
- `lesson-player.tsx`: ensure `buildBeats` forwards every new `surface.<spec>` onto the beat; confirm the `surfaceType` resolver (`:136-155`) handles all new types; confirm both `SurfaceRouter` render sites pass the spec through.
- `apps/web-v2/lib/ai/anthropic-tutor.ts`: add per-surface hints to `SYSTEM_PROMPT` only if the model under-produces a given surface's sub-spec (coding tests, music pattern). Anchoring via the example is primary.

## 4. Implementation standard
- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## 5. Definition of done
- Run the app and play one lesson per tutor (or a representative subset covering each surface): coding renders a code sandbox you can edit/run, art a canvas, music a sequencer, speech/world-languages a mic/voice surface, and the remaining tutors render their assigned surface — none render the bare choice/text box unless explicitly justified.
- Grep `lesson-player.tsx` confirms NO remaining hardcoded surface fixtures (number_line/geometry/coding/art/voice/science/reading defaults all gone).
- A repo-wide grep `surfaceType:\s*"(number_line|coding_sandbox|...)"` in production code now returns real generator-driven emissions (the inverse of the audit's "NONE").
- Verification: `pnpm --filter @aivo/web-v2 build` + e2e in §6.

## 6. Tests
- Unit: `selectSurfaceForItem` returns the expected `surfaceType` for all 14 tutorKeys (table-driven test asserting no tutor maps to a bare generic surface except the justified ones).
- Production-path e2e for at least coding, art, music, and voice (pattern from `lesson-player-surfaces.helpers.ts`), asserting each surface's aria-label renders in a real lesson.
- `pnpm test` + `pnpm --filter @aivo/web-v2 test` green.

## 7. Out of scope
- Content authoring (Sprints 05, 08-09) — surfaces here are filled with whatever content the generator produces; deep authored content comes later.
- The agent `present_surface` path.
- Mobile surface parity (track separately).

## 8. Depends on
- Sprint 02 (contract + wiring). Sprint 03 recommended first (shares the beat-forwarding edits).

## 9. Checkpoint
Provide the full 14-tutor → surface mapping table with justification for any tutor left on a generic surface, paste passing e2e for the expressive surfaces, and confirm all hardcoded fixtures are removed. Pause; do not commit unless told to.

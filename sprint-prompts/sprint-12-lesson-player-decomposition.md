# Sprint 12 — Lesson player decomposition: 1,133 lines → composable modules, zero behavior change

## Goal

At the end of this sprint, `lesson-player.tsx` (1,133 lines — the most pedagogically critical file on the web) is decomposed into a beat state-machine hook plus per-beat components and support modules, **with byte-for-byte identical user behavior** — every existing lesson-player e2e suite passes unchanged — and a file-length CI ratchet prevents the next god file. Closes audit gap **M8a (⚠️)**.

## Context

- **The file:** `apps/web-v2/app/learner/lesson-runs/[lessonRunId]/lesson-player.tsx` — client component driving the beat flow (welcome → goal → story → micro → example → [guided] → [checks] → celebrate → progress → next; story omitted under `shorterSteps`). Verified anchors: `SurfaceRouter` imports `:37-39`; `AACTargetProvider, AACScanRoot` `:42`; counter state `:300-310`; `BREAK_REMINDER_MS` `:273` + interval effect `:397`; accessibility wrapper (`data-reduced-motion` etc.) ~`:870`; AAC mount `:902-906`. Resume mirrors the beat index to `?step=`. **Read the whole file first and write down the actual beat-section boundaries before cutting** — the list above is the audit's summary, not a spec.
- **Already extracted by earlier sprints (build on, don't re-do):** Sprint 08 moved mutations to `lesson-player-mutations.ts` (same dir) with outbox + toasts; Sprint 03 added sensory-var application on the wrapper and `deriveSensoryAdaptations` in `@aivo/stage-runtime`.
- **Behavior freeze contract:** the e2e surface specs are the spec: `apps/web-v2/e2e/lesson-player-{agent,choice-grid,geometry,math,media-captions,number-line,scratchpad}.playwright.ts` + `lesson-player-surfaces.helpers.ts` + `core-journey.playwright.ts` + `learner-smoke.playwright.ts`. They must pass **without modification** (if any spec encodes an internal selector that must change, flag it in the checkpoint with justification — user-visible selectors like test-ids should not need to change).
- **No string changes:** i18n keys and rendered copy untouched (the i18n parity gate plus visual snapshots will catch drift).
- **Server page contract:** `page.tsx` (same dir) passes props (run, plan, accessibility prefs, sensory profile, agent config). The decomposed player keeps the same exported component signature so `page.tsx` needs at most an import-path touch.
- **Ratchet precedent:** `scripts/ci/bundle-budget.mjs` + JSON budgets; mobile's coverage ratchet. CI lint job: `.github/workflows/ci.yml:20`.

## Work orders

### DELETE
1. `lesson-player.tsx` itself at the end — replaced by the module set below re-exported through an index that preserves the import path used by `page.tsx` (or update that one import). No dead code may remain.

### CREATE
All under `apps/web-v2/app/learner/lesson-runs/[lessonRunId]/player/`:
1. `use-beat-machine.ts` — the state machine extracted verbatim-then-tidied: beat order derivation (incl. `shorterSteps` story omission), current index, answered/submitting/lastCorrect transitions, `?step=` resume sync, hint/scaffold/check counters, break entry/exit, completion aggregation. Pure of rendering; unit-testable. Export typed `BeatMachineState`/`BeatMachineActions`.
2. `use-beat-machine.test.ts` — transitions: ordered advance, story-omission, resume-from-step, break interrupt/resume, completion payload shape (mirror what `POST /complete` sends — assert against the mutation module's input type).
3. `beats/` — one component per beat section as found in the real file (expected ≈ `WelcomeBeat`, `GoalBeat`, `StoryBeat`, `MicroBeat`, `ExampleBeat`, `GuidedBeat`, `ChecksBeat` (hosts `SurfaceRouter`), `CelebrateBeat`, `ProgressBeat`) — each ≤ ~200 lines, props-typed, no machine internals leaking (consume `BeatMachineState` slices).
4. `accessibility-shell.tsx` — the wrapper carrying `data-*` a11y attributes + Sprint 03's sensory CSS vars + the `aria-live` status region + AAC mount (`AACTargetProvider`/`AACScanRoot`).
5. `break-screen.tsx` — the break card + `BREAK_REMINDER_MS` interval ownership (effect moves here or into the machine — pick one home and state it).
6. `index.tsx` — composes shell + machine + beats; exports the same component name/props `page.tsx` consumed before.
7. `scripts/ci/check-file-length.mjs` + `scripts/ci/file-length-allowlist.json` — fails CI when any `.ts/.tsx` under `apps/web-v2/{app,components}` or `apps/mobile/src` exceeds **600 lines**, except allowlisted paths. Initial allowlist = the current verified offenders that later sprints own: `apps/web-v2/app/parent/learners/[learnerId]/assessment/page.tsx` (1,144), `apps/web-v2/components/admin/import/csv-import-wizard.tsx` (721), `apps/mobile/src/components/learning/MobileSurfaceRenderer.tsx` (1,578 — Sprint 13 removes it), `apps/mobile/app/(parent)/billing.tsx` (751), and any others the script discovers at baseline (record each with its line count). The decomposed player directory must **not** be allowlisted. Wire into the `lint-and-typecheck` job, no `continue-on-error`.

### REFACTOR
1. Mechanical extraction only: move code into the modules above with minimal edits (imports, prop threading). Resist improving logic mid-move — behavior changes are out of scope. TypeScript strictness must not regress (no new `any`, no `@ts-expect-error`).
2. `page.tsx` — update the player import if the path changed; nothing else.

### EDIT
1. `.github/workflows/ci.yml` lint job — add the file-length gate step.
2. If Sprint 03's `no-inert-prefs` proof tokens referenced `lesson-player.tsx` by path, update the proof entries to the new module paths (`scripts/a11y/no-inert-prefs.mjs`) — the gate must stay green for the right reason.

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## Definition of done

1. **All** existing lesson-player e2e specs + `core-journey` + `learner-smoke` + `stage-sensory` (Sprint 03) pass **unmodified**: `corepack pnpm --filter @aivo/web-v2 exec playwright test lesson-player core-journey learner-smoke stage-sensory`.
2. Visual snapshots covering the player (if any in `visual-a11y`) unchanged — zero pixel-diff (a diff means behavior drifted; investigate, don't re-record).
3. `wc -l` on every file in the new `player/` dir ≤ 600 (target ≤ ~300 for beats); `node scripts/ci/check-file-length.mjs` green repo-wide with the recorded baseline allowlist; negative proof: temporarily add a 601-line scratch file → gate fails → remove.
4. `use-beat-machine.test.ts` green; web-v2 `typecheck`/`lint`/`test` full suite green; `pnpm run a11y:no-inert-prefs` green.
5. Manual smoke: play a lesson end-to-end (hint, break, wrong-then-right answer, complete) — identical experience; offline mid-lesson behavior from Sprint 08 still works (toast + outbox flush).

## Tests

- New: the machine unit tests (this is the lasting payoff — encode the transition table thoroughly).
- Unchanged-by-design: all e2e suites. Run the full web-v2 suite.

## Out of scope

- Any UX/copy/visual change. New beats or surface types. Mobile renderer (Sprint 13). Refactoring `assessment/page.tsx` or `csv-import-wizard.tsx` (allowlisted; separate future work). Performance work beyond what extraction naturally yields.

## Depends on

**Sprint 08** (mutations already extracted; refactoring before it would mean moving the swallowed-catch code twice). Sprint 03's wiring must already be in place (its gate entries are updated here).

## Checkpoint

Summarize: the module map (file → line count → responsibility), the beat boundaries as actually found vs. the audit's summary, machine test coverage list, the file-length baseline JSON content, and proof of unmodified e2e green. **Pause for owner review. Do not commit, stage, or push unless explicitly instructed.**

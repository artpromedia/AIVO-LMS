# Sprint 13 — Mobile surface renderer decomposition: 1,578 lines → per-surface modules + type-safety ratchet

## Goal

At the end of this sprint, `MobileSurfaceRenderer.tsx` (1,578 lines — the largest file in the monorepo and the mobile lesson's beating heart) is decomposed into per-surface modules behind a typed registry, **with identical behavior** (characterization tests written *before* the cut prove it), the file leaves the file-length allowlist, and mobile's TypeScript escape-hatch count (`: any` / `as any` — ~36/27 at audit) is ratcheted down with lint enforcement on the learning directory. Closes audit gap **M8b (⚠️)**.

## Context

- **The file:** `apps/mobile/src/components/learning/MobileSurfaceRenderer.tsx` — a monolithic switch over lesson surface types. Siblings already extracted in the same dir: `MobileChoiceGrid.tsx`, `MobileMathExpressionInput.tsx`, `GeometryCanvas.tsx`, `ScratchPad.tsx`, `HomeworkWorkspace.tsx`, `AssessmentItemRenderer.tsx`, etc. **First action: read the renderer end-to-end and write down the actual surface-type branch list** — the decomposition mirrors reality, not the audit's summary.
- **The shape to mirror:** the web equivalent `packages/learner-surfaces/src/surfaces/` — 14 per-surface components dispatched by a router — proves the decomposition pattern for this exact domain. Mobile gets the same structure natively: `surfaces/<Name>Surface.tsx` + a `surface-registry.ts` mapping `surfaceType → component`.
- **Callers:** `MobileBeatRenderer.tsx` (dispatches `surface` beats here — carries Sprint 04's `reducedMotion`/`motionScale` props which must keep flowing through), `MobileStageRuntime.tsx`, plus homework/assessment screens — grep `MobileSurfaceRenderer` imports across `apps/mobile` and list every caller before cutting; their props contract must not change.
- **Type-safety state (audit-verified):** mobile is the monorepo's `any` outlier (~36 `: any`, ~27 `as any`); worst offenders include `apps/mobile/hooks/useFamily.ts:4`, `apps/mobile/app/(parent)/billing.tsx`, `apps/mobile/app/(learner)/stage/[sessionId].tsx`. Root ESLint has `@typescript-eslint/no-explicit-any` at **warn** (`eslint.config.mjs:44`); mobile owns its config at `apps/mobile/eslint.config.mjs`.
- **Safety nets:** vitest suite (42 files, coverage ratchet — must not drop); the a11y lint gate (error-severity RN a11y rules, `apps/mobile/eslint.config.mjs:57-97`) applies to every new component; Sprint 12's file-length gate has this file allowlisted in `scripts/ci/file-length-allowlist.json` — this sprint removes that entry. Maestro golden path: `.maestro/journeys/login-lesson-offline.yaml`.

## Work orders

### DELETE
1. `MobileSurfaceRenderer.tsx` at sprint end — replaced by the registry + modules; the old filename may remain only as a ≤ 20-line re-export shim **if** callers are numerous and mechanical updates would bloat the diff (decide after the caller census; if a shim stays, it contains zero logic).
2. Its entry in `scripts/ci/file-length-allowlist.json`.

### CREATE
1. **Characterization tests first** — `apps/mobile/src/components/learning/__tests__/surface-renderer-characterization.test.tsx`: for every surface type found in the branch census, render the *current* monolith with minimal valid props and snapshot/assert the key output (prompt rendered, input control present, submit callback wired — fire it and assert the payload shape). These tests are written and **green against the monolith before any extraction begins**, then must stay green against the registry.
2. `apps/mobile/src/components/learning/surfaces/` — one `<Name>Surface.tsx` per branch (≤ ~300 lines each), props-typed with **zero `any`**; shared bits (submit plumbing, prompt header, error display) into `surfaces/shared.tsx` only when ≥ 2 surfaces use them.
3. `apps/mobile/src/components/learning/surface-registry.ts` — `SURFACE_REGISTRY: Record<SurfaceType, ComponentType<SurfaceProps>>` + `resolveSurface(type)` with an explicit typed fallback for unknown types (render the existing unsupported-surface treatment the monolith has — find it; do not invent new copy).
4. `apps/mobile/src/components/learning/surfaces/__tests__/` — per-surface render+submit tests (the characterization tests may be reorganized into these once the cut is complete, as long as total assertions don't shrink).

### REFACTOR
1. Mechanical extraction of each branch into its surface module; the new top-level renderer becomes a thin dispatcher (`registry lookup → render`), threading Sprint 04's motion/announcement props untouched.
2. **`any` ratchet on touched code:** every `: any`/`as any` inside the files this sprint moves or edits gets a real type (the lesson/session types live in the SDK the stage screen imports — follow `stage/[sessionId].tsx`'s session typing to source them). Do not chase `any`s in unrelated files (`billing.tsx`, `useFamily.ts` are out of scope — they're recorded for a future pass).

### EDIT
1. `apps/mobile/eslint.config.mjs` — add an override setting `@typescript-eslint/no-explicit-any: "error"` for `src/components/learning/**` (now clean by construction). Record the repo-wide before/after counts in the checkpoint (`grep -rn ": any\|as any" apps/mobile --include='*.ts*' | grep -v __tests__ | wc -l`).
2. Callers (`MobileBeatRenderer.tsx`, homework/assessment screens per the census) — import path updates only.

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## Definition of done

1. Characterization tests: green on the monolith (pre-cut commit point noted in the checkpoint), green on the registry (post-cut) — **identical assertions**.
2. `corepack pnpm --filter @aivo/mobile test` full suite green; coverage ratchet not lowered (the new tests should raise it — report the delta).
3. `corepack pnpm --filter @aivo/mobile lint` green including the new `no-explicit-any: error` override and the RN a11y rules on all new components.
4. `node scripts/ci/check-file-length.mjs` green with the renderer's allowlist entry **removed**; every new file ≤ 600 lines (`wc -l` listing in the checkpoint).
5. If a simulator/Maestro environment is available: play a lesson hitting at least choice + math + one canvas surface — identical behavior; otherwise state the fallback (tests + caller-diff review) explicitly.

## Tests

- New: characterization + per-surface tests (the durable asset of this sprint).
- Run the full mobile suite; green stays green. Maestro `login-lesson-offline.yaml` if the environment allows.

## Out of scope

- Any behavior/UX/copy change. New surface types. Web player (done, Sprint 12). The `any` cleanup outside the learning dir (recorded, not executed). `MobileBeatRenderer`/`MobileStageRuntime` restructuring beyond import/prop threading.

## Depends on

**Sprint 04** (motion/announcement props must already flow through the renderer so the extraction carries them; doing 13 first would force re-threading). **Sprint 12** (the file-length gate + allowlist this sprint edits must exist).

## Checkpoint

Summarize: the surface-branch census (type → new module → line count), caller census, characterization-test inventory, `any` before/after counts, DoD outputs. **Pause for owner review. Do not commit, stage, or push unless explicitly instructed.**

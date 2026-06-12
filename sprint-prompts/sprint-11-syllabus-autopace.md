# Sprint 11 — Syllabus Auto-Pacing (close the non-obvious second step)

## 1. Goal
After this sprint, saving a school **term syllabus** automatically generates the learner's pacing plan (when pacing is live), so the content a learner is served aligns with the school syllabus **without a separate "Generate pacing plan" click**. The live-only dependencies (brain-svc + `INTERNAL_SERVICE_TOKEN`) are documented and checked by `prod:check`, and the UI no longer presents a saved-but-unpaced syllabus that silently does nothing. GAP-5 is closed.

## 2. Context (no prior knowledge assumed)
J3/J4 (syllabus alignment + holiday path) are real end-to-end, but the full-term path has a non-obvious two-step flow: saving a syllabus does NOT pace it; a separate action does. Verified seams:
- **Save (no pacing):** `apps/web-v2/lib/bff/term-syllabus.ts::handleSaveTermSyllabus` (`:123`) → `createTermSyllabus` (`:172`). It persists `term_syllabi`/`term_syllabus_units` (`packages/db/src/schema/term_syllabus.ts:15,44`) and validates units against the learner's jurisdiction — but never triggers pacing.
- **Generate pacing (separate action):** `apps/web-v2/lib/bff/school-calendar.ts::handleGeneratePacingPlan` (`:347`) → `svcGeneratePlan` (`:201`) POSTs to brain-svc with `source: "uploaded_term_syllabus"`. It is **live-only**: `isPacingLive()` (`:44-45`) = `Boolean(INTERNAL_SERVICE_TOKEN)`; without it, returns `UPSTREAM_UNAVAILABLE` (`:362-371`). `buildTermScopeSequence(syllabus)` (`:134`) builds the brain-svc body.
- **UI:** `apps/web-v2/components/curriculum/term-syllabus-manager.tsx` — `onSave` (`:197`) and `onGeneratePlan` (`:126`) are separate; the "Generate pacing plan" button (`:342`) is on each saved syllabus. So a parent can save and never pace.
- **Delivery proof (already works once paced):** paced weeks feed `curriculum_focus` into lesson generation via `apps/web-v2/lib/db/repos.ts::getActiveCurriculumFocus` (`:3353`) → `brainPacingFocusSafe` → injected at `repos.ts:1901`. So the only gap is the missing automatic trigger.

## 3. Work orders

### DELETE
- Nothing removed. (Keep the manual "Generate pacing plan" button as a re-generate affordance, but it must no longer be the ONLY way to pace.)

### CREATE
- Nothing new structurally; reuse `svcGeneratePlan`/`handleGeneratePacingPlan`.

### REFACTOR
- `apps/web-v2/lib/bff/term-syllabus.ts::handleSaveTermSyllabus`: after a successful `createTermSyllabus`, when `isPacingLive()` is true, automatically invoke the pacing generation for the saved syllabus (call the same path `handleGeneratePacingPlan`/`svcGeneratePlan` uses), so save⇒pace is atomic from the user's perspective. On pacing failure, return a clear partial-success result (syllabus saved, pacing failed, reason) — do NOT silently swallow it, and do NOT fail the save itself.

### EDIT
- `apps/web-v2/components/curriculum/term-syllabus-manager.tsx`: update the save flow/UX so a successful save reflects "saved + paced" (or "saved; pacing unavailable in this environment — set up brain-svc") using the partial-success result. Keep the explicit re-generate button for re-pacing after edits.
- `scripts/production-readiness-check.mjs` (`pnpm prod:check`): add a check that the syllabus/pacing/holiday live dependencies are configured in production (`INTERNAL_SERVICE_TOKEN` set, brain-svc + curriculum-svc URLs reachable/configured), so a prod deploy that would leave syllabus alignment dead fails the readiness gate with a precise message.
- `docs/` (the relevant deploy/runbook doc, e.g. `HETZNER_DEPLOYMENT_GUIDE.md` or a curriculum runbook): document that full-term syllabus alignment + holiday paths require brain-svc + curriculum-svc + `INTERNAL_SERVICE_TOKEN`, and that without them these features fail closed (by design).

## 4. Implementation standard
- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## 5. Definition of done
- With `INTERNAL_SERVICE_TOKEN` + brain-svc running: as a parent/teacher, parse + save a term syllabus → a pacing plan is generated automatically (no separate click), and a subsequent learner lesson is themed to the syllabus focus (verify `curriculum_focus` reflects the uploaded syllabus via a lesson's content/agent persona).
- Without the token (dev): saving returns a clear "saved; pacing unavailable — configure brain-svc + INTERNAL_SERVICE_TOKEN" message, not a silent no-op, and does not error the save.
- `pnpm prod:check` fails (with a precise message) when the live syllabus/pacing dependencies are unset in a production-like config, and passes when set.
- Verification: `pnpm --filter @aivo/web-v2 build && pnpm prod:check && pnpm test`.

## 6. Tests
- Unit/integration for `handleSaveTermSyllabus`: when pacing is live, it triggers generation and returns saved+paced; when not live, it returns the partial-success shape; a pacing failure does not fail the save.
- A `prod:check` assertion for the new live-dependency check (configured vs unset).
- e2e (optional, if brain-svc is available in the e2e harness): save → paced → lesson reflects the syllabus focus.
- `pnpm test` full gate green.

## 7. Out of scope
- Changing the brain-svc pacing engine or the holiday/summer-bridge logic (already real).
- The weekly "this week at school" upload path (already automatic).
- Offline/degraded pacing when brain-svc is down (it fails closed by design; documenting it is enough here).

## 8. Depends on
- None. Independent of other sprints.

## 9. Checkpoint
Summarize the auto-trigger, the partial-success UX, and the `prod:check` dependency gate. Paste evidence of save⇒auto-pace (with token) and the clear message (without token), plus `prod:check` behavior. Pause; do not commit unless told to.

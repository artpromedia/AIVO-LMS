# Sprint 01 — Honest Coverage Gate & Agent-Flag Reconciliation

## 1. Goal
After this sprint, the curriculum coverage gate (`pnpm curriculum:coverage`) **can no longer be satisfied by attestation alone**: a tutor grade-band may be declared `"authored"` only if real, counted item-bank content backs it. Every currently-inflated `coverageMatrix` cell that lacks real content is honestly downgraded to `"scaffold"` (so the catalog shows "authoring in progress" and the tutor-svc runtime refuses to serve it as production content), and the regression baseline is updated to the honest state. Separately, the agentic-tutor feature flag's stale "Nova pilot only" label is reconciled with the real all-14 roster, and an explicit "enabled only behind an eval gate" intent is recorded. This de-risks every later sprint and removes a production-safety/trust hazard (serving 3-activity template stubs or LLM-draft graphs to learners as "authored").

## 2. Context (no prior knowledge assumed)
AIvo-LMS is a pnpm/turbo monorepo. The 14 tutors are declared as `TutorDefinition`s in `services/tutor-svc/src/modes/*Tutor.ts`; each has a `coverageMatrix: Partial<Record<GradeBand, "authored"|"scaffold"|"missing">>`. The SDK (`packages/tutor-sdk/src/coverage.ts`) treats only `"authored"` as production-ready; `packages/tutor-runtime/src/index.ts::planSession` (`:146-161`) throws `grade_band_not_production` when a learner's grade band is not `"authored"` (unless the caller passes `allowScaffold`, fed from `AIVO_ALLOW_SCAFFOLD_CONTENT`, see `services/tutor-svc/src/lib/learnerContext.ts:159-161`).

**Critical fact (verified):** the **web-v2 learner lesson path does NOT read `coverageMatrix`** (`apps/web-v2/lib/db/repos.ts` has zero references to it). So downgrading cells to `"scaffold"` is **safe for the web-v2 learner flow** — it affects only (a) the tutor-svc `planSession` path and (b) the catalog "authoring in progress" badge. It will, however, trip the regression ratchet, so you must update the baseline in the same change.

The gate is `scripts/curriculum-coverage-check.mjs` (`pnpm curriculum:coverage`, `package.json:83`). Today it has 5 checks; the relevant ones:
- **Item-bank counts (`:154-205`)** — it does NOT live-scan items; it OVERRIDES counts with `packages/item-bank/src/production-manifest.json` (`:191-197`). This is gameable.
- **Promotion guard (`:398-538`)** — for each `authored` cell it requires a band-covering `skillGraphRef` to be (a) non-`-draft` version AND (b) present in `docs/quality/tutor-content-signoffs.json`. It does **NOT** check item-bank item counts. The signoffs file currently contains "project-owner-attestation" entries for every 9-12/3-12 graph, which is why everything passes.
- **Regression ratchet (`:349-396`)** vs `docs/quality/tutor-coverage-baseline.json` — `authored` count must not drop; `missing` must not rise. Baseline currently locks nova/sage/pixel at `{authored:14, scaffold:0, missing:0}`.

The authoritative item-bank query API (use this, do not re-implement a regex scan): `getProductionItemsForSubject(subject)` (`packages/item-bank/src/production.ts:86`), `getProductionItemCounts()` (`:115`), and `gradeBandFromSkillId(skillId)` (exported from `packages/item-bank/src/index.ts:95`). `RequiredSubjectSlug` union is at `production.ts:36`. `Item.skillId` is singular; grade is decoded from the skillId via `gradeBandFromSkillId`.

Agent flag: `packages/feature-flags/src/enterprise-flags.ts` — `ENTERPRISE_FLAG_META.tutorAgenticMode` (`:257-266`) has `label: "Agentic tutor mode (Nova pilot)"` and a description saying "Nova (math) only". The real runtime roster is all 14 tutors in `apps/web-v2/lib/bff/agent-pilot.ts` (`PILOT_SUBJECT_TUTORS`, `:18-35`) and `services/tutor-svc/scripts/agent-behavior-harness.ts` (`ONBOARDED_TUTORS`, `:38-53`).

## 3. Work orders

### DELETE
- Nothing is deleted in this sprint. (The manifest override logic is replaced in EDIT, not removed wholesale — keep `production-prek-manifest.json` reads.)

### CREATE
- `docs/quality/tutor-content-signoffs.schema.md` — short doc defining the two signoff tiers the gate now distinguishes: `sme_signoff` (credentialed curriculum designer + SpEd specialist) vs `owner_attestation` (interim). State that `owner_attestation` alone is NOT sufficient for `authored` once this gate ships — an `authored` cell additionally requires the item-count bar below.
- `packages/item-bank/src/coverage-query.ts` — a small exported helper `countAuthoredItems(subjectSlug: RequiredSubjectSlug, gradeBand: GradeBand): number` built on `getProductionItemsForSubject` + `gradeBandFromSkillId` (so the gate and future sprints share ONE authoritative counter). Export it from `packages/item-bank/src/index.ts`.

### REFACTOR
- `scripts/curriculum-coverage-check.mjs`:
  - **Item-bank counting (`:154-205`):** replace the `production-manifest.json` override with a real count via the new `countAuthoredItems` (import from the built `@aivo/item-bank`, mirroring how `packages/item-bank/scripts/validate-production.mjs` consumes `dist/`). Keep the PRE_K manifest read only if PRE_K items are not yet represented in the production seeds; otherwise count them too. The manifest must no longer be able to inflate counts above the real item set.
  - **Promotion guard (`:398-538`):** extend it so an `authored` (tutor, band) cell requires BOTH the existing signoff/non-draft-graph condition AND `countAuthoredItems(subjectSlug, band) >= MIN_AUTHORED_ITEMS_PER_BAND` (define `MIN_AUTHORED_ITEMS_PER_BAND`, e.g. 3, matching the SDK's "≥1 mapped item-bank entry" intent — pick ≥3 so a band has at least intro/core/stretch coverage; document the choice). Cells failing this are hard errors unless their matrix value is `scaffold`/`missing`.

### EDIT
- `services/tutor-svc/src/modes/*Tutor.ts` (all 14): set each `coverageMatrix` cell to the **honest** status the new gate computes. Bands with real, counted item-bank content + a real graph stay `"authored"`; bands backed only by owner-attestation, AI-draft graphs, or <`MIN_AUTHORED_ITEMS_PER_BAND` items become `"scaffold"`. (Expect nova/sage/pixel to keep K — and only the grades where real items exist — as `authored`; most higher grades and the 11 template-only tutors drop to `scaffold`.)
- `docs/quality/tutor-coverage-baseline.json`: regenerate to match the honest matrix so the ratchet passes at the new (lower, honest) `authored` counts. (The ratchet forbids future *decreases*, so this records the new floor.)
- `docs/quality/tutor-content-signoffs.json`: tag each existing `owner_attestation`-style entry with an explicit `tier: "owner_attestation"` field (vs `tier: "sme_signoff"` for the genuinely reviewed ones like `ccss-math-k`), so the gate and reviewers can tell them apart. Do not delete entries.
- `packages/feature-flags/src/enterprise-flags.ts` (`:260-263`): change `label` to `"Agentic tutor mode (eval-gated, all subjects)"` and rewrite the description to state: the in-lesson agent loop is available for all 14 tutors via the runtime roster, defaults OFF, and must remain OFF for a tutor until that tutor passes the real-model eval gate (Sprint 10). Remove the "Nova (math) only" wording.
- Add a one-line cross-reference comment in `apps/web-v2/lib/bff/agent-pilot.ts` near `PILOT_SUBJECT_TUTORS` noting the flag default is OFF and enablement is eval-gated (so the roster's existence is not mistaken for "on").

## 4. Implementation standard
- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## 5. Definition of done
- `pnpm --filter @aivo/item-bank build` succeeds and exports `countAuthoredItems`.
- **Negative proof:** temporarily set one tutor's high grade band (e.g. `mathTutor` grade `12`) back to `"authored"` and run `pnpm curriculum:coverage` → it must FAIL with a message about insufficient authored items for that (tutor, band). Revert the temporary change. (Document this manual check in the Checkpoint.)
- `pnpm curriculum:coverage` passes against the honest matrix + updated baseline.
- `pnpm --filter @aivo/tutor-svc test` (or the repo gate `pnpm test`) passes, including `services/tutor-svc/tests/tutor-registry.test.ts`.
- Catalog/runtime: in tutor-svc, a `planSession` for a now-`scaffold` band throws `grade_band_not_production` (verify via the existing tutor-svc tests, or a focused unit test) — confirming the gate is load-bearing.
- `packages/feature-flags` typecheck/test passes; the flag label no longer says "Nova".
- Verification commands: `pnpm --filter @aivo/item-bank build && pnpm curriculum:coverage && pnpm test`.

## 6. Tests
- Add `packages/item-bank/src/__tests__/coverage-query.test.ts` asserting `countAuthoredItems` returns the real count for a known (subject, grade) and 0 for an empty one.
- Add/extend a test for the coverage gate's new item-count requirement (a fixture tutor with an `authored` band lacking items must be rejected). If the gate script is not unit-testable directly, add an assertion in `services/tutor-svc/tests/tutor-registry.test.ts` that every `authored` band in the shipped modes satisfies `countAuthoredItems >= MIN_AUTHORED_ITEMS_PER_BAND`.
- Run the full repo gate `pnpm test` so prior work stays green.

## 7. Out of scope
- Do NOT author new item-bank/content (that is Sprints 08-09).
- Do NOT wire authored content into the web-v2 lesson path (that is Sprint 05).
- Do NOT change `planSession` behavior or `AIVO_ALLOW_SCAFFOLD_CONTENT` semantics.
- Do NOT enable the agent or build the eval (Sprint 10).
- Do NOT touch `scripts/catalogue-coverage-check.mjs` (a different, unrelated gate over the curriculum-svc snapshot).

## 8. Depends on
- None. Run this first.

## 9. Checkpoint
At sprint end: list every `coverageMatrix` cell changed (per tutor, before→after), the new `MIN_AUTHORED_ITEMS_PER_BAND` value and rationale, the baseline diff, and the flag label change. Paste the output of the negative-proof check and of `pnpm curriculum:coverage`. Pause for review. Do not commit unless told to.

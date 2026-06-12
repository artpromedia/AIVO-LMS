# Sprint 08 — Author Real Nova Math Content (K–2), Consumed & Gate-Clean

## 1. Goal
After this sprint, **Nova (math)** has real, standards-aligned authored content for **Kindergarten, Grade 1, and Grade 2** — content-pack activities + item-bank items + skill-graph nodes — that is **actually consumed** in web-v2 lessons (via the Sprint 05 wiring) and **legitimately** satisfies the truthful coverage gate (Sprint 01) for K-2. A learner placed at K/1/2 math gets real grade-level questions across the grade's skills (not the single 5-activity K demo, not "2+3"). This also establishes the **repeatable authoring pattern** the remaining grades/subjects follow.

## 2. Context (no prior knowledge assumed)
Prerequisite sprints make this meaningful: Sprint 05 made the web-v2 lesson path consume `@aivo/content-pack` activities (and item-bank items) via `apps/web-v2/lib/learner/authored-content.ts::getAuthoredItemsForSkill`; Sprint 01 made `pnpm curriculum:coverage` require real, counted item-bank content (`countAuthoredItems(subject, band) >= MIN_AUTHORED_ITEMS_PER_BAND`) plus a non-draft graph + signoff before a `coverageMatrix` cell may be `"authored"`.

Where content lives (verified):
- **Content packs:** `packages/content-pack/src/seeds/math-k-fall-2026.ts` (`mathKFall2026`, id `"math-k-fall-2026"`, skillGraphRefs `["ccss-math-k"]`, 5 K activities). `ContentPack`/`Activity` types: `packages/content-pack/src/types.ts:89-142` (`Activity` = `{ id, title, skillId, type, prompt, choices?: {id,label,correct?}[], expectedAnswer?, difficulty: "intro"|"core"|"stretch", tags? }`). Packs are registered in `packages/content-pack/src/seeds/index.ts` (`SEEDED_PACKS`, `getSeededPack`). Validator: `packages/content-pack/src/validate.ts::validateContentPack` (multiple_choice must have exactly one `correct`, etc.).
- **Item bank:** runtime shape `Item`/`ItemVariant` (`packages/item-bank/src/types.ts:3-61`; `Item = { id, skillId, variants }`; the stem/choices/answer live in `ItemVariant.body`). Production seeds: `packages/item-bank/src/seed-math.ts` (`MATH_PRODUCTION_ITEMS`, currently ~30 items K-8). Authoring schema (for the import CLI) `AuthoredItem` with first-class `gradeBand` + `skillIds[]`: `packages/item-bank/src/schema.ts:115-134`. Counter (from Sprint 01): `countAuthoredItems` / `getProductionItemsForSubject` (`packages/item-bank/src/production.ts:86`). Sprint 05 fixed the import persist so `pnpm item-bank:import` lands items.
- **Skill graphs:** `packages/skill-graphs/src/seeds/ccss-math-k.ts` (`ccss-math-k`, v1.0.0, 17 K skills, real CCSS codes + prerequisites) and `ccss-math-1-8.ts` (`ccss-math-1-8`, v1.0.0, ~23 skills grades 1-8 — its header says "Deepening each grade's graph is a curriculum-content sprint", i.e. THIS). `Skill` = `{ id, title, description, subject, gradeBand, frameworkRefs, prerequisites }` (`packages/skill-graphs/src/types.ts:80-96`).
- **Mode:** `services/tutor-svc/src/modes/mathTutor.ts` — `skillGraphRefs` (`:34`), `defaultContentPackRefs` (`:35`, `["math-k-fall-2026"]`), `coverageMatrix` (`:36-51`). After Sprint 01 this matrix is honest (likely K authored, 1-12 scaffold); this sprint legitimately flips **1 and 2** to `authored`.
- **Signoffs:** `docs/quality/tutor-content-signoffs.json` (tiered after Sprint 01). Mark new K-2 content with the real curriculum-review tier per your process; do not use owner-attestation to bypass the item-count bar.

Grade-1 and Grade-2 CCSS math domains to cover (representative, standards-aligned): Operations & Algebraic Thinking (1.OA, 2.OA), Number & Operations in Base Ten (1.NBT, 2.NBT), Measurement & Data (1.MD, 2.MD), Geometry (1.G, 2.G). Author against real CCSS codes; never invent codes.

## 3. Work orders

### DELETE
- Nothing structural. (Do not delete the K pack; extend it.)

### CREATE
- `packages/content-pack/src/seeds/math-1-fall-2026.ts` and `math-2-fall-2026.ts` — real `ContentPack`s (gradeBand "1"/"2", skillGraphRefs `["ccss-math-1-8"]`), each with enough activities to cover the grade's core skills at intro/core/stretch difficulty (target ≥3 per skill so `MIN_AUTHORED_ITEMS_PER_BAND` is satisfied with real items). Real prompts, real choices, one correct each, real CCSS skillIds. Register both in `packages/content-pack/src/seeds/index.ts`.
- Item-bank authoring for grades 1-2: add `AuthoredItem` files (the import-CLI schema) OR extend `packages/item-bank/src/seed-math.ts` with real grade-1/2 `Item`s keyed to the CCSS skillIds, ≥`MIN_AUTHORED_ITEMS_PER_BAND` per skill. Run `pnpm item-bank:import` (now persisting, per Sprint 05) so `getProductionItemsForSubject("math")` returns them.

### REFACTOR
- `packages/skill-graphs/src/seeds/ccss-math-1-8.ts`: deepen the **grade 1 and grade 2** skill nodes to the real domain breadth (the file already invites this). Keep `version: "1.0.0"` only if these grades are genuinely review-ready; otherwise keep the per-skill scaffolding marker until reviewed (the gate distinguishes draft vs authored).

### EDIT
- `services/tutor-svc/src/modes/mathTutor.ts`: add `"math-1-fall-2026"`, `"math-2-fall-2026"` to `defaultContentPackRefs`; set `coverageMatrix` `"1"` and `"2"` to `"authored"` (the truthful gate must now pass for them because real items exist).
- `docs/quality/tutor-coverage-baseline.json`: bump nova's `authored` count to include the newly-legitimate K-2 (the ratchet records the new floor).
- `docs/quality/tutor-content-signoffs.json`: add real signoff entries (correct tier) for the grade-1/2 math content + graph bands.
- If the Sprint 05 `getAuthoredItemsForSkill` resolves packs from `defaultContentPackRefs`, no resolver change is needed; otherwise wire the new packs into the resolver's subject→packRefs map.

## 4. Implementation standard
- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## 5. Definition of done
- Run the app (AI off, deterministic path). A learner placed at **Grade 1** math gets lessons whose items are the **authored grade-1** activities across multiple 1.* skills; same for Grade 2. K still works. No "2+3" placeholder and no `authoredPack()` 3-activity template appears for nova.
- `pnpm curriculum:coverage` passes with nova K-2 `authored` **legitimately** (it now satisfies the item-count bar from Sprint 01) — and would FAIL if you removed the grade-1 items (spot-check and document).
- `pnpm curriculum:validate` and `pnpm --filter @aivo/content-pack build` (validateContentPack) pass for the new packs.
- `getProductionItemsForSubject("math")` returns the new grade-1/2 items (import persisted them).
- Verification: `pnpm --filter @aivo/content-pack build && pnpm --filter @aivo/item-bank build && pnpm curriculum:coverage && pnpm test`.

## 6. Tests
- `packages/content-pack` validation test covering the two new packs (structure, single-correct MC, real skillIds).
- A test asserting `getAuthoredItemsForSkill` (web-v2) returns the new grade-1/2 activities for representative skills.
- A coverage-gate assertion that nova K-2 passes the item-count bar with the authored items present and fails without them.
- `pnpm test` full gate green.

## 7. Out of scope
- Grades 3-12 math and the other 13 tutors (backlog; same pattern — see `docs/quality/tutor-k12-coverage-gap-plan.md`). This sprint proves the pattern at K-2.
- Changing the content-consumption wiring (Sprint 05 owns it).
- Surfaces (Sprints 02-04) — authored math items render inside whatever surface the resolver selected (e.g. number line).

## 8. Depends on
- Sprint 05 (authored content consumed by the learner path) and Sprint 01 (truthful coverage gate). Sprint 02 recommended (so the authored math items render on the number line).

## 9. Checkpoint
Summarize the new packs/items/graph depth for grades 1-2, the matrix/baseline/signoff updates, and the negative-proof that removing the items fails the gate. Paste a before/after of a grade-1 math lesson's items and `pnpm curriculum:coverage` output. Pause; do not commit unless told to.

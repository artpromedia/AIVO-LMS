# Sprint 09 — Author Real Sage ELA + Pixel Coding Content (K–2)

## 1. Goal
After this sprint, **Sage (ELA: reading + writing)** and **Pixel (coding)** each have real, standards-aligned authored content for **K–2** that is consumed in web-v2 lessons (Sprint 05 wiring) and legitimately satisfies the truthful coverage gate (Sprint 01). Together with Sprint 08 (Nova math), the three launch tutors carry real K-2 content, and the repeatable authoring pattern is proven for two more subjects (CCSS-ELA and CSTA-coding). The remaining 11 tutors stay honestly `scaffold` ("authoring in progress") pending the curriculum backlog.

## 2. Context (no prior knowledge assumed)
Follow the exact pattern established in Sprint 08 (read it first). Prerequisites: Sprint 05 (web-v2 consumes authored content via `apps/web-v2/lib/learner/authored-content.ts`), Sprint 01 (gate requires real, counted items per `authored` band).

Sage / ELA (verified):
- Mode `services/tutor-svc/src/modes/elaTutor.ts` — `skillGraphRefs` (`:31-39`, incl. `ccss-ela-k`, `ccss-ela-1-8`, `ccss-writing-k-8`), `defaultContentPackRefs` (`:40`, `["ela-k-fall-2026"]`), `coverageMatrix` (`:41-56`).
- Real K pack `packages/content-pack/src/seeds/ela-k-fall-2026.ts` (`elaKFall2026`, skillGraphRefs `["ccss-ela-k"]`, 5 K activities). Graphs `packages/skill-graphs/src/seeds/ccss-ela-k.ts` (v1.0.0, 6 K skills, header: "full K-5 graph ships with the curriculum-content team's pack" — i.e. this) and `ccss-ela-1-8.ts`, `ccss-writing-k-8.ts`.
- ELA reading items pair naturally with the **reading_annotation** surface (Sprint 03) — author passages with selectable evidence spans where possible.

Pixel / coding (verified):
- Mode `services/tutor-svc/src/modes/codingTutor.ts` — `skillGraphRefs` (`:31`, `["prek-coding-foundations","csta-coding-k2","csta-coding-3-12"]`), `defaultContentPackRefs` (`:32`, `["coding-k2-fall-2026"]`), `coverageMatrix` (`:33-48`).
- Real pack `packages/content-pack/src/seeds/coding-k2-fall-2026.ts` (`codingK2Fall2026`, gradeBand "K", 5 activities — sequencing/loops/conditionals). Graph `packages/skill-graphs/src/seeds/csta-coding-k2.ts` (v1.0.0, CSTA 1A).
- Coding items pair with the **coding_sandbox** surface (Sprint 04) — author with real expected outputs/tests for the sandbox where appropriate; early K-2 coding can be block/sequence MCs.

Shared mechanics (same as Sprint 08): `ContentPack`/`Activity` (`packages/content-pack/src/types.ts:89-142`), `validateContentPack`, item-bank `AuthoredItem` → import → `getProductionItemsForSubject`, `countAuthoredItems` bar from Sprint 01, signoffs `docs/quality/tutor-content-signoffs.json` (real tier, not owner-attestation), baseline `docs/quality/tutor-coverage-baseline.json`. Author against real CCSS / CSTA codes; never invent codes.

## 3. Work orders

### DELETE
- Nothing structural (extend, don't remove the K packs).

### CREATE
- ELA: `packages/content-pack/src/seeds/ela-1-fall-2026.ts`, `ela-2-fall-2026.ts` (reading + foundational writing skills; passages for reading_annotation). Register in `seeds/index.ts`.
- Coding: `packages/content-pack/src/seeds/coding-1-fall-2026.ts`, `coding-2-fall-2026.ts` (CSTA 1A progression). Register in `seeds/index.ts`.
- Item-bank `AuthoredItem` sets for ELA grades 1-2 and coding grades 1-2 (≥`MIN_AUTHORED_ITEMS_PER_BAND` per skill), imported so `getProductionItemsForSubject("ela")` / `("coding")` return them. (Note `RequiredSubjectSlug` uses subject slugs — confirm the exact slugs for ELA/coding in `packages/item-bank/src/production.ts:36`.)

### REFACTOR
- Deepen `packages/skill-graphs/src/seeds/ccss-ela-1-8.ts` / `ccss-writing-k-8.ts` (grades 1-2) and `csta-coding-k2.ts` (extend to grades 1-2 or add a `csta-coding-1-2` graph if cleaner) to real domain breadth, keeping honest version/scaffolding markers.

### EDIT
- `services/tutor-svc/src/modes/elaTutor.ts` and `codingTutor.ts`: add the new pack refs to `defaultContentPackRefs`; set `coverageMatrix` grades `"1"`,`"2"` to `"authored"` (gate must pass with real items).
- `docs/quality/tutor-coverage-baseline.json`: bump sage + pixel authored counts to the new legitimate floor.
- `docs/quality/tutor-content-signoffs.json`: add real signoff entries (correct tier) for ELA/coding K-2.

## 4. Implementation standard
- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## 5. Definition of done
- Run the app (AI off). A learner at Grade 1/2 reading gets the authored ELA items (rendered in the reading-annotation surface where authored); a learner at Grade 1/2 coding gets the authored coding items (in the coding sandbox where authored). K still works for both. No `authoredPack()` template content appears for sage/pixel.
- `pnpm curriculum:coverage` passes with sage + pixel K-2 `authored` legitimately (item-count bar met); removing the new items fails the gate (spot-check, document).
- `validateContentPack` + `pnpm curriculum:validate` pass for all new packs.
- Verification: `pnpm --filter @aivo/content-pack build && pnpm --filter @aivo/item-bank build && pnpm curriculum:coverage && pnpm test`.

## 6. Tests
- content-pack validation tests for the 4 new packs.
- `getAuthoredItemsForSkill` returns the new ELA/coding items for representative skills.
- Coverage-gate assertions for sage + pixel K-2 (pass with items, fail without).
- `pnpm test` full gate green.

## 7. Out of scope
- Grades 3-12 and the other 11 tutors (backlog — `docs/quality/tutor-k12-coverage-gap-plan.md`).
- Surface wiring (Sprints 03-04) — this sprint fills those surfaces with authored content but does not change surface selection.
- Content for the other subjects' baseline bank.

## 8. Depends on
- Sprint 05 (consumption wiring), Sprint 01 (truthful gate). Sprints 03 (reading surface) and 04 (coding surface) recommended so the authored content renders in-domain.

## 9. Checkpoint
Summarize the new ELA + coding packs/items/graph depth, the matrix/baseline/signoff updates, and the negative-proof gate check. Paste before/after of a grade-1 reading and a grade-1 coding lesson, and `pnpm curriculum:coverage` output. Pause; do not commit unless told to.

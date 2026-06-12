# Sprint 05 — Wire Authored Content Into the Learner Lesson Path

## 1. Goal
After this sprint, web-v2 lessons **draw their guided-practice and check items from authored content** (`@aivo/content-pack` activities / `@aivo/item-bank` items) for the learner's resolved (subject, skill, grade band) whenever such content exists — so (a) authoring content actually changes what a learner sees, (b) the deterministic fallback serves **real grade-level questions instead of the hardcoded "What is 2 + 3?"**, and (c) the previously-dead seeded packs (`math-k-fall-2026`, `ela-k-fall-2026`, `coding-k2-fall-2026`) become live. The item-bank import CLI is fixed to actually persist authored items so future authoring lands real content. The LLM provider is anchored to the authored items (stay on-skill, on-grade) rather than free-improvising.

## 2. Context (no prior knowledge assumed) — read carefully, this corrects a common misconception
A read-only trace established that **the web-v2 learner lesson path consumes NEITHER `@aivo/item-bank` NOR `@aivo/content-pack`** today:
- `apps/web-v2/package.json` depends on `@aivo/skill-graphs` but NOT on `@aivo/item-bank` or `@aivo/content-pack`.
- Lesson content is produced by `generateLessonPlanWithRetry` (`apps/web-v2/lib/ai/tutor.ts:96`): LLM (Claude, `apps/web-v2/lib/ai/anthropic-tutor.ts`) in prod, else `generateDeterministicLessonPlan` (`apps/web-v2/lib/learner/lesson-plan.ts:239`). The deterministic builders have **hardcoded inline questions** — `mathPractice` (`:136-187`, e.g. `"What is 2 + 3?"` `:142`), `readingPractice` (`:82-134`), `genericPractice` (`:189-209`) — with placeholder `skillId: ""` later stamped with the runtime skill.
- The authored packs are dead elsewhere too: `defaultContentPackRefs` (e.g. `mathTutor.ts:35`) is never dereferenced; tutor-svc `planSession` uses the scaffold `services/tutor-svc/src/content-packs/*.pack.ts` starters via `getStarterContentPack`, not the seeded `math-k-fall-2026`.

So this sprint makes **`@aivo/content-pack` the authored-content source the learner path consumes.** Choose `@aivo/content-pack` as the canonical source (its `Activity` shape — `packages/content-pack/src/types.ts:89-114` — already matches what a lesson item needs: `prompt`, `choices` `{id,label,correct?}`, `expectedAnswer?`, `skillId`, `difficulty` `"intro"|"core"|"stretch"`, `type`). The real launch packs and their loader exist:
- `packages/content-pack/src/seeds/{math-k-fall-2026,ela-k-fall-2026,coding-k2-fall-2026}.ts` (5 activities each, gradeBand "K"), assembled into `SEEDED_PACKS` and looked up by `getSeededPack(id)` (`packages/content-pack/src/seeds/index.ts:30-40`, re-exported from `packages/content-pack/src/index.ts`).
- Each tutor mode's `defaultContentPackRefs` names its pack(s) (`services/tutor-svc/src/modes/mathTutor.ts:35` → `"math-k-fall-2026"`).

Item-bank import stub (fix it so authoring can land items): `packages/item-bank/src/cli/import.ts:48-52` is `NULL_PERSIST_ADAPTER` (returns the id, persists nothing); `cli/bin.ts:55-66` only has a `--persist=prisma` path gated on an `ITEM_BANK_PERSIST_MODULE` env that "lives in assessment-svc once the items model ships". The `AuthoredItem`→`ItemVariant` conversion is described at `packages/item-bank/src/schema.ts:14`.

`createLessonRun` already resolves subject + skill + grade band before generation (`apps/web-v2/lib/db/repos.ts:1875-1906`), so the authored-content resolver has everything it needs.

## 3. Work orders

### DELETE
- Remove the hardcoded inline question banks in `apps/web-v2/lib/learner/lesson-plan.ts` (`mathPractice`/`readingPractice`/`genericPractice` literal questions) **only after** the authored-content path is in place — replace them with a thin, generic procedural fallback used solely when no authored content exists for a skill (e.g. a single neutral practice item derived from the skill name, clearly generic, not pretending to be grade content). Do not leave both the old hardcoded set and the new path.
- Remove `NULL_PERSIST_ADAPTER` usage as the default in `packages/item-bank/src/cli/bin.ts` once a real persist adapter exists (keep a `--dry-run` flag for validation-only runs).

### CREATE
- `apps/web-v2/lib/learner/authored-content.ts` — exported `getAuthoredItemsForSkill(input: { subjectSlug, tutorKey, skillId, gradeBand }): AuthoredLessonItem[]`. It loads the tutor's `defaultContentPackRefs` (resolve the refs by reading the tutor's `TutorDefinition` from `@aivo/brand`/registry, or a new small subject→packRefs map), calls `getSeededPack(ref)` from `@aivo/content-pack`, filters `pack.activities` by `skillId` (and grade band), and maps each `Activity` to the lesson item shape (`prompt`, `choices`, `expectedAnswer`, `hint`/`scaffold` from activity fields or sensible defaults). Returns `[]` when none exist. This is the single seam later authoring sprints add content behind.
- A real item-bank persist adapter: `packages/item-bank/src/cli/persist-json.ts` (or wire the existing intended adapter) that writes converted `ItemVariant`s into the appropriate `seed-*.ts`/a generated JSON the production loader reads, so `pnpm item-bank:import <file>` actually lands items that `getProductionItemsForSubject` returns. (If a DB-backed model is preferred, implement the documented `ITEM_BANK_PERSIST_MODULE` contract for real — no stub.)

### REFACTOR
- `apps/web-v2/lib/learner/lesson-plan.ts::generateDeterministicLessonPlan`: source `guidedPractice` + `checksForUnderstanding` from `getAuthoredItemsForSkill(...)` when available (mapping difficulty `intro/core/stretch` to the guided→check progression), falling back to the thin generic item only when the skill has no authored content. Preserve the brain-profile/accommodation theming and the `surface` attachment from Sprints 02-04 (the surface envelope wraps the authored item).
- `apps/web-v2/lib/ai/anthropic-tutor.ts`: when authored items exist for the skill, pass them into the prompt as the **required source material** ("use these authored items; adapt wording for the learner's profile but keep the skill/answer fidelity"), not just as a shape example. Keep the schema-validated fallback.
- `apps/web-v2/package.json`: add `"@aivo/content-pack": "workspace:*"` (and `@aivo/item-bank` if the resolver uses item-bank items) to dependencies.

### EDIT
- `services/tutor-svc/src/routes/tutorSession.ts` (`:174-181`): make `planSession` resolve `defaultContentPackRefs` via `getSeededPack` (the real authored packs) as the default content pack, instead of `getStarterContentPack` (the scaffold starters), so the tutor-svc path and the web-v2 path consume the SAME authored source. Keep request-body `contentPack` override behavior.

## 4. Implementation standard
- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## 5. Definition of done
- Run the app (AI provider OFF, so the deterministic path is exercised). Start a **math K** lesson for a learner placed at K: the guided/check items are the **authored** `math-k-fall-2026` activities (e.g. the real counting/geometry items), NOT "What is 2 + 3?". Start a lesson for a skill with no authored content: it shows the neutral generic fallback (clearly generic).
- Prove authoring matters: add one new activity to `math-k-fall-2026.ts` for a K skill, restart, and see it appear in that skill's lesson.
- `pnpm item-bank:import <a real AuthoredItem file>` persists items such that `getProductionItemsForSubject(...)` returns them (no dry-run-only behavior by default).
- tutor-svc `planSession` for nova now plans from `math-k-fall-2026` activities (verify via tutor-svc tests or a focused check), not `nova-math-k-starter`.
- Verification: `pnpm --filter @aivo/web-v2 build && pnpm --filter @aivo/content-pack build && pnpm --filter @aivo/item-bank build && pnpm test`.

## 6. Tests
- Unit `apps/web-v2/lib/learner/__tests__/authored-content.test.ts`: `getAuthoredItemsForSkill` returns the real activities for a known K math skill and `[]` for an unknown skill.
- Unit: `generateDeterministicLessonPlan` for a K math skill yields the authored items (assert a known authored prompt appears), and the generic fallback for an unauthored skill.
- Item-bank: a test that `import` → persist → `getProductionItemsForSubject` round-trips a sample `AuthoredItem`.
- Update tutor-svc tests for the `getSeededPack` default. Run `pnpm test` so prior sprints stay green.

## 7. Out of scope
- AUTHORING new grade content (Sprints 08-09 add K-2 depth now that the path consumes it). This sprint wires the path and may rely on the existing 5-activity K packs to demonstrate it.
- The coverage gate changes (Sprint 01 — independent; this sprint makes the gate's item-count requirement meaningful end-to-end but does not modify the gate).
- Surfaces (Sprints 02-04). Keep their `surface` envelope intact when sourcing authored content.

## 8. Depends on
- None hard. Recommended after Sprint 02 (so authored items can also carry surface specs). Sprint 01 ideally first (so "authored" is honest), but not a hard dependency.

## 9. Checkpoint
Summarize: the chosen canonical source (`@aivo/content-pack`), the `getAuthoredItemsForSkill` resolver, the deterministic-generator refactor, the import persist fix, and the tutor-svc `getSeededPack` switch. Paste evidence that a math K lesson now uses authored items (before/after) and that a new authored activity appears. Pause; do not commit unless told to.

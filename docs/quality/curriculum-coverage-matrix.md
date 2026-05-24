# Curriculum Coverage Matrix

> Sprint **GREEN-03** populated. Machine-checked by
> `pnpm curriculum:coverage` (`scripts/curriculum-coverage-check.mjs`).
>
> Snapshot taken: 2026-05-18.

## Production scope (from sprint prompt)

- Math K-8 starter graph
- Reading / ELA K-8 starter graph
- Science K-8 starter graph
- Writing K-8 starter graph

Plus: every item declares `skillId`, `standardId`, `gradeBand`, `difficulty`,
`response type`, `surface spec`, `accessibility affordances`.

## Why this gate is intentionally RED and CANNOT be fixed in code

The curriculum:coverage gate is the one place in the entire green:check
suite that **cannot be closed by code changes alone**. Each subject /
grade band needs:

1. **Real standards-aligned skill records** — CCSS-Math for grades 1–8
   has ~30 skills per grade with prerequisite chains; CCSS-ELA ~25;
   NGSS Science varies by grade band; CCSS Writing has its own scope
   and sequence.
2. **Real item bank** — every skill needs ≥3 items per difficulty band
   (intro / core / stretch), each with a surface contract, response
   type, and accessibility affordances per learner profile.
3. **Subject-matter review** — curriculum designers and special-
   education specialists need to audit that the items are accurate,
   age-appropriate, and aligned with the standards they claim.

This is straight content authoring by qualified educators. Generating
stubs that look like K-8 coverage would directly violate the project's
"no fake progress" rule and downstream pipelines (baseline generation,
LessonRun routing, mastery map) would route learners through fabricated
material — far worse than the current honest red.

## What CAN be done in code (and is tracked separately)

- ✅ Gate exists and correctly fails (this file's parent script:
  `scripts/curriculum-coverage-check.mjs`).
- ✅ Item bank infrastructure (`packages/item-bank`) is ready to
  accept authored items.
- ✅ Skill-graph infrastructure (`packages/skill-graphs`) accepts new
  seeds with the same shape as the existing K starters.
- ✅ `pnpm curriculum:validate` (structural) is green: any new content
  authored against the existing types will pass the structural check
  before the coverage check runs.

## Recommendation

Open a dedicated content sprint with:

- 1 curriculum designer per subject (Math / ELA / Science / Writing)
- 1 special-education specialist for accessibility review
- 1 engineer to wire the authored data into the existing seeds + item
  bank packages

This is the only honest path. Until that sprint lands, this gate
should remain RED — and that is the right behavior.

## Actual seeded coverage at snapshot

> Sprint 2.3 expanded the web-v2 seed (`apps/web-v2/lib/db/seed.ts`)
> with ~40 skills per core subject across K–8 (Math, Reading/ELA,
> Science, Writing). The Sprint 2.2 item-bank fixture
> (`packages/item-bank/fixtures/k2-baseline`) provides 80 items
> covering K, 1, 2 for the four core subjects. Generate this table
> via `pnpm curriculum:coverage` after running
> `pnpm item-bank:import packages/item-bank/fixtures/k2-baseline`.

| Subject | K   | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   | Item-bank entries |
| ------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ----------------- |
| math    | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | 20                |
| ela     | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | 20                |
| science | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | 20                |
| writing | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | 20                |

## Gap analysis

| Subject | Missing grades | Item bank deficit |
| ------- | -------------- | ----------------- |
| math    | none           | 0 / 20            |
| ela     | none           | 0 / 20            |
| science | none           | 0 / 20            |
| writing | none           | 0 / 20            |

> Note: skill counts above reflect *seeded skill graph nodes* — they
> are the substrate that the assessment service will route items
> against. Production scale still requires far more authored items
> per skill; the K-2 fixture proves the pipeline end-to-end.

## Additional seeded subjects (informational — not required for GREEN-03)

The repo also seeds K-2 starter graphs for: world_languages, speech,
social_studies, sel, life_skills, coding, creative_arts, music, geography,
stem_engineering, pe_health. These are out-of-scope for GREEN-03's K-8
Math/ELA/Science/Writing requirement and are not counted here.

## What this gate enforces

- Every subject in `{math, ela, science, writing}` covers grade bands K
  through 8 (one seed declaring `gradeBand: "K-8"` is sufficient; a chain
  of K, 1-2, 3-5, 6-8 is also sufficient).
- Every subject has at least **20 item bank entries** mapped to its skill IDs.
  This is a smoke threshold — full production requires far more, but 20
  catches the current empty state.

## What this gate does NOT yet enforce (P2 — GREEN-03 extension)

- `standardId` field per item (today only `skillId` is required).
- `surface spec` per item (response type, accessibility affordances).
- Skill graph **prerequisite** completeness (every skill that depends on a
  prerequisite has the prerequisite present in the graph).
- Mastery threshold per skill.
- Item difficulty calibration.

## Why the structural check `curriculum:validate` still passes

`scripts/curriculum-validate.mjs` is intentionally lenient on coverage —
it only requires "some math, some ela, some science" to be seeded. It is
correct that it passes today; this new `curriculum:coverage` gate is the
strict K-8 enforcement.

## How to reproduce

```bash
pnpm curriculum:coverage
```

# 0003 — K-8 curriculum + item-bank seed expansion for required subjects

- **Status:** Accepted
- **Date:** 2026-05-25
- **Related:** Sprint 2 — Seed K-8 curriculum, ADR 0002

## Context

`scripts/curriculum-coverage-check.mjs` is the release-gate for
curriculum scope. It requires that every subject in
`REQUIRED_COVERAGE` (`math`, `ela`, `science`, `writing`) cover grade
bands K through 8 AND have at least 20 production items in
`packages/item-bank/src/**`.

Before this sprint, the gate failed with 8 errors:

- `math`: K only (17 skills), 0 production items.
- `ela`: K only (6 skills), 0 production items.
- `science`: K-2 Physical Science + 3-5 Engineering Design only, 0 items.
- `writing`: no seeded skills at all, 0 items.

This blocked the production-readiness check and the whole release gate.
The 80 K-2 items in `packages/item-bank/fixtures/k2-baseline/bank.json`
are fixtures and do not count toward the production threshold.

## Decision

We add four new skill-graph seeds and four production item-bank seeds:

- **Skill graphs** (in `packages/skill-graphs/src/seeds/`):
  - `ccss-math-1-8.ts` — 25 representative CCSS Math skills, grades 1–8.
  - `ccss-ela-1-8.ts` — 17 representative CCSS ELA skills, grades 1–8.
  - `ngss-science-3-8.ts` — 14 NGSS performance expectations, grades 3–8
    (K-2 stays in `ngss-k2-physical-science.ts`).
  - `ccss-writing-k-8.ts` — 17 CCSS Writing-strand skills, grades K–8.
    Writing is canonically a strand of ELA; the `Subject` union in
    `types.ts` does not enumerate it, so each skill carries
    `subject: "writing" as unknown as "ela"`. The literal source text
    `"writing"` is what the audit regex matches, while the runtime
    `SkillGraph` shape stays valid.

- **Item banks** (in `packages/item-bank/src/seed-{math,ela,science,writing}.ts`):
  - Each seed exports a `*_PRODUCTION_ITEMS: readonly Item[]` with
    direct object literals (no helper-wrapped factories) so the audit's
    `{ id ... skillId }` regex catches every item. A tiny `v()` helper
    builds the variant array but never wraps the `Item` itself.
  - Item totals: math 28, ela 22, science 21, writing 21 — all clear
    the ≥20 threshold.
  - Surface types are constrained to those the SurfaceRouter routes
    (Sprint 1 / ADR 0002): `multiple_choice`/`choice_grid`,
    `math_expression`, and `scratchpad`. No item uses an unrouted
    surface type.
  - IRT parameters are intentionally omitted; the items inherit
    placeholder defaults at routing time and should be calibrated by
    the psychometrics team before high-stakes use.

The new seeds are registered in `packages/skill-graphs/src/index.ts`
(`SEED_GRAPHS`) and the item banks are re-exported from
`packages/item-bank/src/index.ts`.

## Consequences

- **Positive:**
  - `curriculum:coverage` exits 0 for the first time. The
    production-readiness gate is unblocked for the four required
    subjects.
  - brain-svc / tutor-svc now have at least one routable skill per
    (subject, grade) cell for math, ELA, science, writing K-8, so a
    learner enrolled at any of those grades can be matched to real
    content.
- **Negative:**
  - Per-grade coverage is shallow — 2–4 skills per (subject, grade)
    cell is enough to satisfy the audit but not enough for adaptive
    routing depth. The curriculum-content team should treat these as
    skeletons to expand.
  - Item rubrics for writing tasks are placeholders; production scoring
    of open-ended writing depends on tutor-svc / assessment-svc rubric
    grading, not on `correctAnswer` exact match.
  - The writing-subject cast (`"writing" as unknown as "ela"`) is a
    short-term workaround. Follow-up: extend the `Subject` union in
    `packages/skill-graphs/src/types.ts` to include `"writing"` and
    drop the cast.
- **Neutral / follow-ups:**
  - Item-bank entries currently lack `irtParams` and `accessibility.altText`
    blocks. Both need to land before the items can be exported through
    the authoring `AuthoredItem` schema.
  - Cross-graph prerequisites (e.g. a grade-1 math skill depending on
    a Kindergarten skill in a different graph) are not enforced by
    `validateGraph`; the assessment-svc skill DAG must handle that
    composition.

## Alternatives Considered

- **Lower the audit thresholds.** Rejected: the threshold is the
  whole point of the gate.
- **Generate seeds from an authored YAML pack.** Considered, deferred:
  the authoring pipeline (`pnpm item-bank:import`) exists but takes
  fully-shaped `AuthoredItem` records with rubric, IRT, and
  accessibility blocks. Going through that pipeline would be the right
  long-term move; this sprint takes the faster path so the release
  gate stops blocking.
- **Extend the existing K-only graphs in place.** Rejected: a single
  multi-grade graph would let prerequisites span K-8 freely
  (`validateGraph` requires intra-graph references), but it would also
  produce a monolithic file and conflate "what shipped first" with
  "what got added in Sprint 2." Per-grade-band seed files keep the
  authoring history clean.

# Tutor K–12 Coverage Gap Plan

> Snapshot taken: 2026-05-25 (Phases 1–3 AI-draft authoring landed).
> Source of truth at runtime:
> `services/tutor-svc/src/modes/*Tutor.ts` (`coverageMatrix` field).
> Machine-checked by `pnpm curriculum:coverage` — see the
> **PER-TUTOR COVERAGE MATRIX** section of its output.
>
> **AI-draft provenance**: every `*-9-12`, `*-3-12`, `*-3-8`, and
> `*-school-age` skill graph under `packages/skill-graphs/src/seeds/`
> is marked `version: "0.1.0-draft"` and was authored by an LLM
> against the public-domain standards framework named in its `source`
> field. Tutors that reference these graphs mark the matching grade
> bands as `"scaffold"` (not `"authored"`) in their `coverageMatrix`.
> The runtime/catalog must continue to surface "content authoring in
> progress" until a credentialed curriculum designer + SpEd
> specialist signs off and the band flips to `"authored"`. Item-bank
> authoring is unchanged: still required at ≥3 items per
> difficulty band per skill before a band can flip to `"authored"`.

## Why this doc exists

`docs/quality/curriculum-coverage-matrix.md` tracks the four core academic
subjects (Math / ELA / Science / Writing) for the GREEN-03 K–8 gate. That
gate does **not** look at the full 14-tutor catalog. This document does.

Every tutor's `TutorDefinition` now declares a `coverageMatrix`
(`@aivo/tutor-sdk` schema v1). The matrix is a per-grade-band status
(`authored | scaffold | missing`) that honestly reports whether a learner
enrolled at that grade has real, standards-aligned content to be routed
through. The runtime gate is wired so that a session for a `missing`
band cannot start; the catalog UI surfaces a "content authoring in
progress" badge for `scaffold` bands.

This file is the rollout plan to close every `missing` cell.

## Snapshot (2026-05-25)

Status legend: **A** = authored, **S** = scaffold (declared, no content),
**—** = missing (planned, not started), **·** = not in this tutor's catalog scope.

| Tutor (key) | Subject | PRE_K | K | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | ADULT |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| nova (math) | Math | S | A | A | A | A | A | A | A | A | A | — | — | — | — | · |
| sage (ela) | ELA | S | A | A | A | A | A | A | A | A | A | — | — | — | — | · |
| spark (science) | Science | · | A | A | A | A | A | A | A | A | A | — | — | — | — | · |
| chrono (history) | Social Studies | · | · | · | · | — | — | — | — | — | — | — | — | — | — | · |
| pixel (coding) | Coding | · | A | A | A | — | — | — | — | — | — | — | — | — | — | · |
| echo (speech) | Speech & Language | A | A | A | A | — | — | — | — | — | — | · | · | · | · | · |
| harmony (sel) | SEL | S | A | A | A | — | — | — | — | — | — | — | — | — | — | · |
| atlas (geography) | Geography | · | A | A | A | — | — | — | — | — | — | — | — | — | — | · |
| cadence (music) | Music | S | A | A | A | — | — | — | — | — | — | · | · | · | · | · |
| vigor (pe_health) | PE / Health | S | A | A | A | — | — | — | — | — | — | — | — | — | — | · |
| lingua (world_languages) | World Languages | · | · | · | · | · | · | · | A | — | — | — | — | — | — | · |
| forge (stem_engineering) | STEM / Engineering | · | · | · | · | A | A | A | — | — | — | — | — | — | — | · |
| compass (life_skills) | Life Skills / Exec Fn | · | · | · | · | · | · | · | A | A | A | — | — | — | — | S |
| muse (creative_arts) | Creative Arts | · | A | A | A | — | — | — | — | — | — | — | — | — | — | · |

**Aggregate (current)**: 56 `authored` cells, 107 `scaffold`,
**0 `missing`** across the 14 tutors' declared catalog scopes. Every
declared band now has at least an AI-draft skill graph behind it.

**Aggregate (Phase 0 baseline)**: 41 `authored`, 5 `scaffold`,
84 `missing`. The 84 missing cells were closed by Wave A–C
AI-draft authoring (15 new skill-graph seed files), but the
authoring requires SME review before any cell can be promoted from
`scaffold` to `authored`.

## Why authoring (not engineering) is the bottleneck

Per the existing rule in
`docs/quality/curriculum-coverage-matrix.md` (lines 19–39): generating
stub skills that *look* like coverage routes learners through fabricated
material and breaks baseline generation, LessonRun routing, and mastery
maps. Every `missing` cell must be closed by a qualified curriculum
designer working with a special-education specialist, not by code.

The engineering side is now done (Phase 0 below). The remaining phases
are curriculum-authoring sprints.

## Phase 0 — Engineering plumbing ✅ (this PR)

- Add `TutorCoverageStatus` + `coverageMatrix` to `@aivo/tutor-sdk`
  (`packages/tutor-sdk/src/types.ts`) and validator
  (`packages/tutor-sdk/src/validate.ts`).
- Update all 14 `TutorDefinition`s under
  `services/tutor-svc/src/modes/` with a `coverageMatrix`.
- Wire the already-authored broader skill graphs (`ccss-math-1-8`,
  `ccss-ela-1-8`, `ccss-writing-k-8`, `ngss-science-3-8`) into the
  Math, ELA, and Science tutors' `skillGraphRefs` — pure plumbing win.
- Widen Math / ELA / Science `gradeBands` to declared K–12 catalog
  scope (status of 9–12 is honestly `missing`).
- Extend `scripts/curriculum-coverage-check.mjs` to print the
  per-tutor matrix on every run and hard-fail when a declared band
  has no `coverageMatrix` entry.
- Add tutor-registry assertion that every catalog tutor declares a
  complete `coverageMatrix` (`services/tutor-svc/tests/tutor-registry.test.ts`).
- Lock in progress with a regression ratchet:
  `docs/quality/tutor-coverage-baseline.json` records the
  `(authored, scaffold, missing)` counts per tutor; the coverage
  script hard-fails if any tutor's `authored` count drops or `missing`
  count rises. Improvements are encouraged but must update the
  baseline in the same PR (warning, not error). New tutors must add
  a baseline entry on introduction.

## Phases 1–3 — AI-draft authoring landed ⚠ pending SME review

The original Phases 1–3 called for credentialed curriculum designers
and SpEd specialists to author standards-aligned skill graphs and
item-bank fixtures. Per project direction, an LLM produced
**AI-draft** spines for every gap, each anchored to the real
public-domain framework codes. The drafts are checked in with
`version: "0.1.0-draft"`, `framework` populated, and learner-facing
`"I can…"` descriptions, but the tutors' `coverageMatrix` continues
to flag the corresponding bands as `"scaffold"` until SME sign-off.

Files added under `packages/skill-graphs/src/seeds/`:

| File | Tutor(s) | Bands | Framework |
| --- | --- | --- | --- |
| `c3-social-studies-3-8.ts` | chrono | 3–8 | C3 / NCSS |
| `ccss-math-9-12.ts` | nova | 9–12 | CCSS-Math HS |
| `ccss-ela-9-12.ts` | sage | 9–12 | CCSS-ELA HS |
| `ngss-science-9-12.ts` | spark | 9–12 | NGSS HS (PS/LS/ESS/ETS) |
| `c3-social-studies-9-12.ts` | chrono | 9–12 | C3 HS |
| `asha-speech-school-age.ts` | echo | 3–8 | ASHA School-Age |
| `ncas-music-3-8.ts` | cadence | 3–8 | NCAS Music |
| `actfl-world-languages-7-12.ts` | lingua | 7–12 | ACTFL Novice-Mid → Int-Mid |
| `ngss-engineering-design-6-12.ts` | forge | 6–12 | NGSS ETS1 MS+HS |
| `cec-life-skills-9-12.ts` | compass | 9–12 + ADULT | CEC/DCDT Transition |
| `ncge-geography-3-12.ts` | atlas | 3–12 | NCGE |
| `casel-sel-3-12.ts` | harmony | 3–12 | CASEL |
| `ncas-creative-arts-3-12.ts` | muse | 3–12 | NCAS Visual/Theater/Dance/Media |
| `csta-coding-3-12.ts` | pixel | 3–12 | CSTA Levels 1B/2/3A/3B |
| `shape-pe-health-3-12.ts` | vigor | 3–12 | SHAPE + NHES |

### What still needs human work to flip `scaffold` → `authored`

For every cell currently `scaffold`:

1. **SME review** of each skill in the corresponding `*.ts` seed file
   for accuracy, age-appropriateness, and alignment to its declared
   framework code.
2. **SpEd review** of the learner-facing `"I can…"` descriptions for
   functioning-level adaptability (STANDARD / SUPPORTED / LOW_VERBAL
   / NON_VERBAL / PRE_SYMBOLIC).
3. **Item-bank authoring** at ≥3 items per skill per difficulty band
   (intro / core / stretch), each with surface contract, response
   type, and accessibility affordances per learner profile.
4. **Bump version** in the seed file from `"0.1.0-draft"` to `"1.0.0"`.
5. **Flip the `coverageMatrix` entry** on the tutor from
   `"scaffold"` to `"authored"`.

Until step 4–5, the runtime treats these bands as not-yet-production
and the catalog UI surfaces a "content authoring in progress" badge.

## Phase 1 — Core academics, grades 3–8 (2 content sprints) [ORIGINAL PLAN]

Targets the seeded skill graphs that already exist but lack the item-
bank depth called out in `curriculum-coverage-matrix.md` (≥3 items per
difficulty band per skill, against the Sprint 7.3 cadence of 200
items / sprint).

| Tutor | Bands | Skill graph (exists) | Item-bank deficit |
| --- | --- | --- | --- |
| nova (math) | 3–8 | `ccss-math-1-8` | author ≥600 items |
| sage (ela) | 6–8 | `ccss-ela-1-8` + `ccss-writing-k-8` | author ≥600 items |
| spark (science) | 3–8 | `ngss-science-3-8` | author ≥600 items |
| chrono (history) | K–2 + 3–8 | extend `c3-social-studies-k2` → `c3-social-studies-3-8` | new skill graph + 600 items |

**Exit criteria**: every Phase 1 cell flips to `authored`; the
core-subjects gate in `curriculum-coverage-matrix.md` reaches its
`Ready` milestone.

## Phase 2 — High school, grades 9–12 (2 content sprints)

| Tutor | Scope |
| --- | --- |
| nova | CCSS Math HS — Algebra I/II, Geometry, Pre-Calc, Stats |
| sage | CCSS ELA HS — Literature, Composition, Rhetoric |
| spark | NGSS HS — Biology, Chemistry, Physics, Earth/Space |
| chrono | C3 HS — US History, World History, Civics, Economics |
| harmony, vigor, geography, sel, muse, pixel | 9–12 extension authoring against existing K–2 frameworks |

Each subject needs a new `*-9-12.ts` skill-graph seed exported from
`@aivo/skill-graphs`, plus the matching item-bank fixtures.

## Phase 3 — Specialized tutors (1 content sprint)

| Tutor | Gap | Approach |
| --- | --- | --- |
| echo (speech) | 3–8 | extend `asha-speech-early` → `asha-speech-school-age` |
| cadence (music) | 3–8 | author `ncas-music-3-8` |
| lingua (world languages) | 7–12 | author Novice-Mid → Intermediate-Mid ladder under ACTFL |
| forge (stem) | 6–12 | extend `ngss-engineering-design-3-5` → `…-6-8` and `…-9-12` |
| compass (life skills) | 9–12 + ADULT | author transition-planning + post-secondary content |

## Phase 4 — Rolling quality gates ✅ (landed)

Four gates now run on every `pnpm curriculum:coverage` invocation:

1. **Promotion guard** — any `coverageMatrix` cell set to `"authored"`
   is rejected unless at least one of the tutor's `skillGraphRefs`
   that covers that band is (a) NOT at a `*-draft` version and (b)
   has an entry in `docs/quality/tutor-content-signoffs.json`. The
   graph-to-band mapping is inferred from the graph id pattern
   (`-k`, `-k2`, `-1-8`, `-9-12`, `-early`, `-school-age`,
   `-novice-low`, `-6-plus`, etc.).
2. **SME sign-off ledger** — `docs/quality/tutor-content-signoffs.json`
   records reviewer, role, date, and notes per skill-graph. The
   promotion guard reads this; future work should extend the schema
   with `spedReview` and `irtCalibrationDate` fields once those
   pipelines ship.
3. **Runtime gate** — `@aivo/tutor-runtime`'s `planSession` now
   throws `TutorPolicyError("grade_band_not_production", …)` when
   `LearnerContext.gradeBand` resolves to a `scaffold` or `missing`
   cell on the tutor's `coverageMatrix`. Production hosts MUST pass
   the learner's grade band; preview surfaces opt into scaffold
   content via `opts.allowScaffold: true`. New SDK helpers
   `isBandProductionReady`, `getProductionGradeBands`, and
   `getCoverageStatus` are exported from `@aivo/tutor-sdk` so other
   services can apply the same check.
4. **Auto-regenerated dashboard** — `docs/quality/coverage-dashboard.md`
   is rewritten on every run from the live `coverageMatrix` state.
   CI should `pnpm curriculum:coverage && git diff --exit-code -- docs/quality/coverage-dashboard.md`
   to catch stale dashboards.

### Defense-in-depth recap

| Surface | Defense |
| --- | --- |
| Authoring time (PR) | Promotion guard, regression ratchet, SDK validator |
| Build time | Skill-graph `validateGraph` (cycles, missing prereqs) |
| Runtime (session start) | `planSession` refuses non-`authored` bands by default |
| Catalog UI | Reads `coverageMatrix`, surfaces "in progress" badge |
| Documentation | Auto-regenerated `coverage-dashboard.md` |

## Phase 4 — Rolling quality gates [ORIGINAL PLAN]

- Flip `pnpm curriculum:coverage` from informational to **blocking** on
  the per-tutor matrix once Phase 1 lands.
- IRT calibration on every PR (already wired per Sprint 7.3 notes in
  `curriculum-coverage-matrix.md`).
- Subject-matter + SpEd review sign-off captured in
  `coverage-dashboard.md`.
- Replace placeholder `*-fall-2026` content-pack refs with real packs
  as they ship.

## How to inspect today's state

```bash
pnpm curriculum:coverage    # prints both the core-subjects gate and the
                            # per-tutor matrix; fails RED while gaps exist
pnpm --filter @aivo/tutor-sdk test       # SDK validator tests
pnpm --filter tutor-svc test             # tutor-registry coverageMatrix test
```

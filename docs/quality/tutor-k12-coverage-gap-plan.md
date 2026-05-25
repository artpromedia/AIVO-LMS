# Tutor K–12 Coverage Gap Plan

> Snapshot taken: 2026-05-25. Source of truth at runtime:
> `services/tutor-svc/src/modes/*Tutor.ts` (`coverageMatrix` field).
> Machine-checked by `pnpm curriculum:coverage` — see the
> **PER-TUTOR COVERAGE MATRIX** section of its output.

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

**Aggregate**: 41 `authored` cells, 5 `scaffold`, 84 `missing` across
the 14 tutors' declared catalog scopes. Three subjects (Math, ELA,
Science) reach K–8 authored coverage today thanks to the
`ccss-math-1-8`, `ccss-ela-1-8`, `ccss-writing-k-8`, and
`ngss-science-3-8` skill graph seeds; every other tutor is K–2 only.

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

## Phase 1 — Core academics, grades 3–8 (2 content sprints)

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

## Phase 4 — Rolling quality gates

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

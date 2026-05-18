# Skill-graph + item-bank contract (Sprint 05)

This document is the source-of-truth contract for everything curriculum
in AIVO_LMS. Every baseline, mastery update, LessonRun, Today's Mission,
homework item, and teacher assignment must satisfy this contract — or
the action is rejected at the service boundary, not at the UI.

The contract is enforced by:

- `packages/skill-graphs/src/graph.ts::validateGraph()` (unit-tested)
- `packages/item-bank/src/validate.ts::validateItemVariant()` (unit-tested)
- `scripts/curriculum-validate.mjs` (root script `curriculum:validate`,
  gated by `.github/workflows/production-gates.yml`)

## Skill-graph schema

A skill graph is a directed acyclic graph (DAG) of curriculum skills.
Anchored type definitions live in `packages/skill-graphs/src/types.ts`.

| Field           | Type             | Required           | Notes                                                                                                                                                                                 |
| --------------- | ---------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | string           | yes                | Stable, e.g. `ccss-math.K.CC.A.1`                                                                                                                                                     |
| `title`         | string           | yes                | Short tutor-narration label ("Count to 10")                                                                                                                                           |
| `description`   | string           | yes                | One-sentence learner-facing ("I can count from 1 to 10")                                                                                                                              |
| `subject`       | `Subject` enum   | yes                | math / ela / science / social_studies / geography / coding / speech / sel / life_skills / executive_function / music / pe_health / world_languages / stem_engineering / creative_arts |
| `gradeBand`     | `GradeBand` enum | yes                | PRE_K / K / 1–12 / ADULT                                                                                                                                                              |
| `frameworkRefs` | `FrameworkRef[]` | yes\*              | At least one CCSS/NGSS/WIDA/etc. code, OR `authoringMeta.scaffolding === "true"` for pedagogical-bridge skills                                                                        |
| `prerequisites` | `string[]`       | yes (may be empty) | Other skill IDs that must be mastered first                                                                                                                                           |

\* "Scaffolding" skills are the only exception. They bridge between
formal standards and exist as authoring aids; mark them explicitly
with `authoringMeta: { scaffolding: "true" }` or the validator will
warn (and Sprint 14's content-quality eval will flag them as
ungrounded for generation).

## Supported frameworks

| Framework                  | Scope                                          |
| -------------------------- | ---------------------------------------------- |
| `CCSS-Math`, `CCSS-ELA`    | U.S. Common Core (national reference)          |
| `NGSS`, `NGSS-Engineering` | Next Generation Science Standards              |
| `WIDA-ELD`                 | English Language Development                   |
| `ISTE`, `CSTA`             | Technology / Computer Science                  |
| `C3`, `NCSS`, `NCGE`       | Social studies / geography                     |
| `CASEL`                    | Social-emotional learning                      |
| `ASHA`                     | Speech-language                                |
| `NCAS`, `SHAPE`, `ACTFL`   | Creative arts / PE / world languages           |
| `CEC-LS`                   | Council for Exceptional Children — life skills |

State overrides are handled at the item-bank layer (a state may
override item content while keeping the same skillId).

## Versioning

Skill graphs are content artifacts. Lifecycle states:

| State        | Meaning                                                                            |
| ------------ | ---------------------------------------------------------------------------------- |
| `draft`      | Authoring; not visible to learners                                                 |
| `active`     | Default state for production                                                       |
| `deprecated` | Visible only to existing in-flight mastery records; not selected for new baselines |
| `archived`   | Read-only; preserved for audit + DSAR exports only                                 |

Sprint 05 baseline ships all 14 seed graphs as `active` (see
`packages/skill-graphs/src/index.ts::SEED_GRAPHS`). When a graph moves
to `deprecated`, baseline + Today's Mission selection skips it; mastery
records that reference it keep resolving via `getSeedGraph()` so a
learner who started mastering the graph can finish.

## Item-bank schema

| Field                      | Type                              | Required                                                    |
| -------------------------- | --------------------------------- | ----------------------------------------------------------- |
| `Item.id`                  | string                            | yes                                                         |
| `Item.skillId`             | string                            | yes — must resolve to a skill in some live graph            |
| `Item.variants`            | `ItemVariant[]`                   | yes — at least one `active` variant per Item to be routable |
| `ItemVariant.version`      | semver                            | yes — bump for ANY content change                           |
| `ItemVariant.cohortWeight` | `[0,1]`                           | yes — drives deterministic cohort routing                   |
| `ItemVariant.publishedAt`  | ISO-8601                          | yes                                                         |
| `ItemVariant.body`         | object                            | yes — accommodation hints, surface spec, content            |
| `ItemVariant.status`       | `active`/`retired`/`experimental` | yes                                                         |

`packages/item-bank/src/routing.ts::pickVariant()` partitions learners
across variants deterministically via FNV-1a(`learnerId|itemId`), so a
learner sees the same variant on retry. Retired variants are excluded
even if `cohortWeight > 0`.

## Generation constraints

Generators MUST refuse to produce an item or lesson against:

- a skill id that does not resolve via `getSkill(graph, id)` in any
  `active` graph (Sprint 05 enforcement is the prerequisite for Sprint
  07 baseline + Sprint 14 AI safety gates)
- a learner whose grade band has no `active` graph in the requested
  subject

Baseline assembly (Sprint 07) chains: parent assessment + brain
profile + IEP-derived accommodations + learner gradeBand →
`SEED_GRAPHS.filter(active)` → `pickVariant` per item.

## Launch coverage (Sprint 05 baseline)

| Subject          | Grade bands shipped                                        | Source                                             |
| ---------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| math             | K (CCSS-Math)                                              | `ccssMathKindergarten`                             |
| ela              | K (CCSS-ELA)                                               | `ccssElaKindergarten`                              |
| science          | K–2 (NGSS Physical Science), 3–5 (NGSS Engineering Design) | `ngssK2PhysicalScience`, `ngssEngineeringDesign35` |
| social_studies   | K–2 (C3)                                                   | `c3SocialStudiesK2`                                |
| geography        | K–2 (NCGE)                                                 | `ngsGeographyK2`                                   |
| coding           | K–2 (CSTA)                                                 | `cstaCodingK2`                                     |
| speech           | early childhood (ASHA)                                     | `ashaSpeechEarly`                                  |
| sel              | K–2 (CASEL)                                                | `caselSelK2`                                       |
| music            | K–2 (NCAS)                                                 | `ncasMusicK2`                                      |
| creative_arts    | K–2 (NCAS)                                                 | `ncasCreativeArtsK2`                               |
| pe_health        | K–2 (SHAPE)                                                | `shapePeHealthK2`                                  |
| world_languages  | Novice Low (ACTFL)                                         | `actflWorldLanguagesNoviceLow`                     |
| stem_engineering | 3–5 (NGSS-ETS1)                                            | `ngssEngineeringDesign35`                          |
| life_skills      | 6+ (CEC)                                                   | `cecLifeSkills6Plus`                               |

Sprint 05 launch requirement (validator-enforced): `math`, `ela`,
`science` must each have at least one seed graph. Other subjects ship
starter graphs but are not hard-blocking for baseline.

## Sprint 05 deferred to follow-ups

These are real gaps tracked here so subsequent sprints have a single
backlog to drain. They are not TODOs in code:

- Grade-band fill for math/ELA grades 1–8 (currently K only)
- Per-item accommodations metadata schema (Sprint 06 IEP integration
  hooks the items to learner accommodations)
- State-override layer (Sprint 12 lights this up alongside SIS sync)
- `pnpm curriculum:seed` runner — populates the curriculum-svc database
  from `SEED_GRAPHS` on a fresh tenant; ships with Sprint 06 onboarding

## Verification

```bash
pnpm curriculum:validate          # structural scan + subject coverage
pnpm --filter @aivo/skill-graphs test
pnpm --filter @aivo/item-bank test
pnpm --filter @aivo/content-pack test
pnpm --filter @aivo/pedagogy test
```

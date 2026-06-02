# 0007 — Subject registry: `productionReady` flag; learner UI hides non-ready subjects

- **Status:** Accepted
- **Date:** 2026-05-25
- **Related:** Sprint 6, ADR 0003 (curriculum K-8 seeds), ADR 0004 (production item bank)

## Context

`packages/brand/src/subjects.ts` declares the canonical 12 LEARNER_SUBJECTS
that the learner UI, admin tools, marketing site, tutor matcher and
brain profiler all read from. Three of those 12 (`social-studies`,
`world-languages`, `coding`) had no production item bank as of Sprint 2:

- `social-studies` had skill seeds (CCSS K-2) but zero items;
- `world-languages` had ACTFL Novice-Low skill seeds but zero items;
- `coding` had CSTA K-2 skill seeds but zero items.

The learner UI handled this with a `COMING_SOON_SUBJECT_SLUGS` set in
`apps/web-v2/lib/feature-flags.ts` and a "Coming soon" / "Content is on
the way" branch in `apps/web-v2/app/learner/subjects/page.tsx`. That
branch was the only remaining `route:audit` failure on this branch.

A learner viewing the subjects grid saw cards that looked clickable
(despite being `locked={true}`) and copy that admitted the platform
wasn't actually delivering the subject. Both are honesty failures —
shipping placeholder UI to learners is worse than shipping nothing.

## Decision

We add a per-subject `productionReady: boolean` flag to the brand
registry and filter the learner UI through it. Non-ready subjects keep
their registry rows (so admin, marketing, tutor matching, brain
profiling all keep working) but disappear from the learner-facing
subject grid until their curriculum + items land.

- **`packages/brand/src/subjects.ts`**
  - New required field `productionReady: boolean` on `LearnerSubject`.
  - Each row in `LEARNER_SUBJECTS` stamped explicitly:
    - `true`: `reading`, `math`, `science`, `writing` (the four
      required-coverage subjects with K-8 skill seeds + ≥20 items).
    - `false`: the remaining eight (`social`, `speech`,
      `executive-function`, `life`, `art`, `social-studies`,
      `world-languages`, `coding`). These have brand/tutor/brain
      identity but no production curriculum yet.
  - New helper `getProductionReadySubjects()` — the only function the
    learner UI should call when rendering the subject grid.

- **`apps/web-v2/app/learner/subjects/page.tsx`**
  - Filters `listSubjects()` by `getProductionReadySubjects()` slugs
    before rendering.
  - The entire `comingSoon` branch is gone — no `locked={true}` card,
    no "Coming soon" / "Content is on the way" copy.
  - Translations from Sprint 4's `learner.subjects` namespace remain.

- **`apps/web-v2/lib/feature-flags.ts`**
  - Retires `subjectContentReadyEnabled()`, `isSubjectComingSoon()`,
    and the `COMING_SOON_SUBJECT_SLUGS` set. The header comment now
    points to `getProductionReadySubjects()` as the replacement.

- **`apps/web-v2/lib/subjects/registry.test.ts`**
  - Four new tests pin the `productionReady` contract: every subject
    declares the boolean, `getProductionReadySubjects()` returns only
    ready rows, the four required-coverage subjects are ready, and
    `world-languages` + `coding` keep their registry rows but stay out
    of the production-ready set.
  - Fixes a pre-existing `VALID_BRAINS` set lag — `social_emotional`,
    `executive_function`, `life_skills` are now recognised brains.

## Consequences

- **Positive:**
  - `route:audit` is green for the first time on this branch (was
    failing on the "Coming soon" placeholder).
  - `pnpm check:no-coming-soon` is clean.
  - The learner subject grid now shows only what the platform can
    actually deliver — four real subjects with full K-8 coverage and
    item banks (per Sprints 2 + 3).
  - The brand registry remains the single source of truth for the
    full inventory; tutor matching (`tutorForSubjectSlug`), brain
    profiles, and marketing surfaces are unchanged.
  - A subject ships to learners by flipping one bit and landing the
    curriculum + items — no further UI code change.
- **Negative:**
  - Eight subjects disappear from the learner UI overnight (they were
    already non-functional, but their presence in the grid implied
    capability the platform didn't have). UX-side: this is the right
    move; product-comms-side: any marketing claim of "12 subjects"
    needs softening to "4 today, 8 in active development."
  - The shape of the `LearnerSubject` interface widened. Every consumer
    that constructs a literal `LearnerSubject` must now supply
    `productionReady`. No such constructor exists outside the brand
    package today; the `as const satisfies readonly LearnerSubject[]`
    cast in `LEARNER_SUBJECTS` catches any future drift.
- **Neutral / follow-ups:**
  - The BFF (`apps/web-v2/lib/db/seed.ts`'s `WEB_SEEDED_SUBJECT_SLUGS`)
    still seeds 10 of the 12 subjects (omitting `social-studies` and
    `world-languages`). With the production-ready filter in place the
    UI no longer renders them anyway, but the BFF and the brand
    registry will eventually want a single source of truth. Tracked
    separately.
  - Three pre-existing test failures in `apps/web-v2/lib/db/__tests__/seed.test.ts`
    (missing `social-studies` in BFF seed; aspirational ≥40-skills
    threshold the BFF seed never met) are out of scope; they predate
    this sprint and are owned by the assessment-svc / BFF-seed
    integration sprint.

## Alternatives Considered

- **Replace "Coming soon" with a friendlier empty state.** Rejected:
  shipping subject cards a learner can't actually use is the problem;
  rewording it just disguises the problem.
- **Drop `world-languages` and `coding` from the brand registry
  entirely.** Rejected: tutor (Lingua, Pixel) and brain (`coding`,
  `world_language`) vocabularies still need to know about them, and
  the curriculum-content team is actively growing into them. Removing
  the rows would break tutor matching and force a partial-revert when
  content lands.
- **Keep the feature-flag gate and just remove the literal "Coming
  soon" string.** Rejected: route-audit's regex catches it; replacing
  with a synonym just kicks the can.

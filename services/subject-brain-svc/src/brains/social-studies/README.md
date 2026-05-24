# Social-Studies Brain

Drives the `social_studies` subject (learner slug `social-studies`).

## Skills

Seeded with ~50 skills spanning four NCSS strands across K-8:

- **Civics** — rules, government structure (local/state/federal),
  constitutional principles, citizenship, the legal system
- **Geography** — maps, U.S. and world regions, physical and human
  geography, environment
- **History** — chronology, Native peoples, colonial America,
  Revolution, Civil War, civil rights, 20th-century world conflicts,
  ancient and medieval world
- **Economics** — needs/wants, goods/services, scarcity, markets,
  trade, money

See `services/skill-graph-store.ts` for the full graph (prefixes
`SS.CIV.*`, `SS.GEO.*`, `SS.HIST.*`, `SS.ECON.*`, `SS.CUL.*`).

## Model

Standard IRT-lite (3PL). `selectNextItem` picks the unseen item whose
difficulty is closest to the learner's theta. `score()` is a thin
correctness mapping. `adapt()` modulates difficulty up when the recent
5-item rolling correctness exceeds 0.8 and down when it dips below 0.4,
dropping to `choice_grid` on the way down so we re-anchor with a visual.

## Items

30 fixture items in `items.ts`, mixing surfaces:

- **Text** — `choice_grid` for vocabulary and quick recall
- **Video** — `video` for primary-source clips (e.g. the Declaration of
  Independence, the March on Washington, the migration explainer). Every
  video item ships with a `captionUrl` per the Sprint 7.2 captions
  requirement.
- **Map workspace** — selected via the `recommendedSurfaces` step in
  `context()` for geography topics.

## Misconceptions

Social-studies misconceptions (e.g. "the President can pass laws alone",
"the Civil War was only about states' rights") live alongside the rest
of the registry in `misconception-store.ts`.

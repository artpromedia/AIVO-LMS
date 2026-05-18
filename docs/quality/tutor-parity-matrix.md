# Tutor Parity Matrix

> Sprint **GREEN-00** stub; populated by Sprint **GREEN-02**.
>
> **Rule:** Every tutor is green only when it has all of: brand catalog entry,
> runtime registry entry, persona prompt, subject/skill mapping, supported
> stage beats, fallback that is logged and safe, accessibility metadata
> (reduced-motion avatar state, read-aloud voice profile, pronunciation
> overrides), analytics events, and tests.

## Status legend

- 🟢 green — all columns satisfied, tests green
- 🟡 yellow — partial; missing tests / persona / avatar / a11y metadata
- 🔴 red — missing or stubbed

## Canonical tutors (14)

| Tutor key | Display name | Subject / domain | Status | Notes |
|-----------|--------------|------------------|--------|-------|
| nova    | Nova    | TBD | ⚫ TBD | |
| sage    | Sage    | TBD | ⚫ TBD | |
| spark   | Spark   | TBD | ⚫ TBD | |
| chrono  | Chrono  | TBD | ⚫ TBD | |
| pixel   | Pixel   | TBD | ⚫ TBD | |
| echo    | Echo    | TBD | ⚫ TBD | |
| harmony | Harmony | TBD | ⚫ TBD | |
| atlas   | Atlas   | TBD | ⚫ TBD | |
| cadence | Cadence | TBD | ⚫ TBD | |
| vigor   | Vigor   | TBD | ⚫ TBD | |
| lingua  | Lingua  | TBD | ⚫ TBD | |
| forge   | Forge   | TBD | ⚫ TBD | |
| compass | Compass | TBD | ⚫ TBD | |
| muse    | Muse    | TBD | ⚫ TBD | |

GREEN-02 must verify each tutor against the legacy AIVO-AI-LEARNING catalog and
populate every column from the sprint prompt (Runtime definition, AI persona
prompt, Safety constraints, Learner surface support, Assessment support,
LessonRun support, Homework support, Avatar asset, Reduced-motion avatar
state, Read-aloud voice profile, Pronunciation overrides, Accessibility
affordances, Analytics events, Tests).

## GREEN-02 deliverable

`scripts/tutor-parity-check.mjs` (not yet implemented) must:

- read this matrix plus `packages/brand` and `packages/tutor-runtime` registries
- fail if any tutor key resolves with no persona, no subject mapping, no
  accessibility metadata, or emits an unsupported surface type
- fail if the runtime accepts an unknown tutor key without logged safe fallback
- fail if any production tutor avatar is emoji-only

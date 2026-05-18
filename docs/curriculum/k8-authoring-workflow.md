# K-8 curriculum authoring workflow

AIVO_LMS can store, validate, and route curriculum content, but it must not treat generated or placeholder content as production K-8 curriculum. Production Math, ELA, Science, and Writing content requires subject-matter review and SPED review.

## Source of truth

K-8 curriculum packs live under `curriculum/k8/*.json` and validate against `@aivo/curriculum-authoring`.

Each pack contains:

- standards references
- skill graph nodes
- unit and lesson blueprints
- item-bank items
- accessibility and accommodation supports
- SME review records

## Required approvals

Before a pack can be imported into production:

1. Every skill, unit, lesson, template, and item must have `review.status = "sme_approved"`.
2. The pack-level `metadata.expertReviews` must include a SPED specialist approval.
3. The pack-level `metadata.expertReviews` must include one subject reviewer for every subject represented in the pack.
4. Item-bank open-response questions must include rubrics.
5. Selected-response questions must include at least two options and at least one correct option.

## Validate a pack

```bash
pnpm curriculum:validate-pack curriculum/k8/sample-pack.json
```

## Runtime integration

The package exposes two adapters:

- `toSkillGraphs(pack)` converts an approved K-8 pack into the `@aivo/skill-graphs` shape.
- `toItemBank(pack)` converts approved pack items into the `@aivo/item-bank` shape.

The existing `curriculum-svc` remains read-only. This authoring package is the write-path contract used before publishing generated snapshots into the read-only service.

## Non-goal

This does not create a complete K-8 curriculum. It creates the validated authoring and review infrastructure so curriculum designers can safely add the complete scope later.

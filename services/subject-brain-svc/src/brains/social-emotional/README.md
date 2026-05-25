# Social-Emotional Brain

CASEL-aligned brain for the `social_emotional` subject (mapped to the
`social` learner-facing slug in `@aivo/brand`).

## Skills

Five CASEL core competencies (see `services/skill-graph-store.ts`):

- `SEL.SELF_AWARE` — self-awareness
- `SEL.SELF_MANAGE` — self-management
- `SEL.SOCIAL_AWARE` — social-awareness
- `SEL.RELATIONSHIP` — relationship skills
- `SEL.DECISION` — responsible decision-making

## Model

**Non-graded.** SEL never emits pass/fail. `score()` instead maps
response payload depth onto four mastery bands:

| Band         | Mastery | Meaning                                  |
| ------------ | ------- | ---------------------------------------- |
| `emerging`   | 0.25    | First encounter, just starting to notice |
| `developing` | 0.50    | Recognizes the concept, needs support    |
| `consistent` | 0.70    | Applies it without prompting             |
| `reflective` | 0.90    | Could teach / model it to peers          |

Item selection prefers the learner's lowest-mastery competency so
exposure cycles across the CASEL grid. Adaptation modulates **surface**
(not difficulty) — if the learner skips repeated open-response items,
the brain drops to lower-stakes `choice_grid`.

## Content safety

Every item is reviewed offline and tagged `metadata.safetyChecked = true`.
At runtime, `services/responsible-ai-svc` runs the standard child-safety
classifier on free-form learner output before it is logged or fed back
into the brain. Items themselves stay text-only and avoid trauma cues.

## Items

20 items live in `items.ts` — 5 per CASEL competency (excluding
responsible decision-making, which is covered by reflection layered on
top of the other four in production lesson plans).

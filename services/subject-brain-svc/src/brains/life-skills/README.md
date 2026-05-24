# Life-Skills Brain

Drives the `life_skills` subject (learner slug `life`).

## Skills

- `LIFE.SELF_CARE` — self-care routines
- `LIFE.SAFETY` — personal safety
- `LIFE.MONEY` — money basics
- `LIFE.HOUSEHOLD` — household tasks
- `LIFE.COMMUNITY` — community navigation

## Model

Mixed grading:

- **Discrete-answer items** (e.g. "which coin is a quarter?") use
  IRT-lite 3PL on correctness.
- **Procedural / multi-step routines** (e.g. "show how to brush teeth")
  score on `stepsCompleted / totalSteps` instead of right/wrong. Partial
  completion is celebrated — the routine is the rubric.

Adaptation keeps the same shape as ExecFunc: stepping difficulty up only
when correctness is consistent, and dropping to `choice_grid` when the
routine pool runs ahead of the learner.

## Items

5 fixture items, one per skill family. Real ramp comes from the Sprint-7
content authoring cadence — life skills benefit heavily from photo cards,
which the validator now requires for any item authored after that sprint.

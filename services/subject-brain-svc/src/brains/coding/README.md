# Coding Brain

Drives the `coding` subject (tutor key `pixel` / persona
`ADDON_TUTOR_CODING`).

## Skills

- `CODE.FOUND.SEQUENCING` — first / then / last
- `CODE.FOUND.LOOPS` — repeating an action
- `CODE.FOUND.CONDITIONALS` — if-then choices
- `CODE.FOUND.DEBUG` — find and fix a bug

Standards: CSTA K-2 (1A.AP.10, 11, 14, 15).

## Model

IRT-lite 3PL on correctness for discrete items. Debugging items can
score on `bugsFound / totalBugs` when the payload provides those
counts — partial bugs found still counts as progress.

Adaptation steps difficulty up when correctness is consistent and
drops to `drag_manipulative` when the learner is fighting abstract
syntax rather than the concept.

## Items

4 fixture items covering one item per skill family. Sprint D content
authoring cadence will ramp the K-2 set first, then expand into
3-5 via the existing content-pack pipeline.

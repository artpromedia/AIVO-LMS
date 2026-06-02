# Executive-Function Brain

Drives the `executive_function` subject (learner slug `executive-function`).

## Skills

- `EF.WORKING_MEMORY`
- `EF.INHIBITION`
- `EF.FLEX` (cognitive flexibility)
- `EF.PLAN`
- `EF.TASK_INITIATION`

## Model

**IRT-lite 3PL** on a _latency-weighted_ correctness signal — not raw
correctness. The reasoning: in EF tasks, a correct answer that took 30
seconds and required four corrections reveals more cognitive load than
it does mastery, and a "wrong" answer that came back instantly may just
be a guess.

`score()` composes:

```
mastery = correctness − latencyPenalty − correctionPenalty
```

Where `latencyPenalty` penalizes both <300ms (guess) and >30s (overload),
and `correctionPenalty` scales linearly with revert count.

`adapt()` increases difficulty only when the learner is fast, accurate,
and not flailing. When latency spikes or corrections climb, it drops
difficulty _and_ recommends a lower-load surface (`choice_grid` instead
of `multi_step_workspace`).

## Items

Seeded with 5 fixture items per skill family — production ramps via the
Sprint-7 authoring cadence.

# XP & Completion-Quality Metrics

This document describes the multi-signal formulas used by `learning-svc` and
`tutor-svc` to award XP and compute completion-quality scores at the end of
every learner session. The reference implementations live in:

- `services/learning-svc/src/services/scoring.ts`
- `services/tutor-svc/src/services/scoring.ts`

The two implementations are intentionally kept in sync.

## Inputs (signals)

Both formulas take the following signals. Anything not supplied falls back to a
defensible default so the formulas degrade gracefully when upstream telemetry is
sparse.

| Signal             | Type    | Source                               |
| ------------------ | ------- | ------------------------------------ |
| `durationSeconds`  | number  | session start → complete             |
| `functioningLevel` | string  | brain state                          |
| `messageCount`     | number  | tutor session message log            |
| `beatsCompleted`   | number? | interaction beats from the lesson UI |
| `beatsTotal`       | number? | interaction beats from the lesson UI |
| `correctAnswers`   | number? | per-beat grading                     |
| `attemptedAnswers` | number? | per-beat grading                     |
| `engagementBeats`  | number? | distinct learner responses           |
| `breaksUsed`       | number? | BreakCloud telemetry                 |
| `masteryDelta`     | number? | mean(after − before) across skills   |

## XP formula

```
base_xp                = correct_answers * 10
duration_bonus         = min(duration_minutes * 2, 20)
mastery_bonus          = max(0, mastery_delta) * 50
level_engagement_bonus = functioning_level_weight * engagement_beats
total                  = clamp(base + duration + mastery + level_eng, 0, 100)
```

`functioning_level_weight` table:

| Functioning level | Weight |
| ----------------- | ------ |
| STANDARD          | 1.0    |
| SUPPORTED         | 1.5    |
| LOW_VERBAL        | 2.0    |
| NON_VERBAL        | 2.5    |
| PRE_SYMBOLIC      | 3.5    |

### Pre-symbolic / non-verbal override

For learners at `NON_VERBAL` or `PRE_SYMBOLIC` we can't measure correctness in
the same way. The formula switches to:

```
engagement_xp   = engagement_beats * level_weight * 4
duration_bonus  = min(duration_minutes * 2, 20)
mastery_bonus   = max(0, mastery_delta) * 50
total           = clamp(engagement_xp + duration_bonus + mastery_bonus, 0, 100)
```

This means a PRE_SYMBOLIC learner who participates for 5 engagement beats earns
`5 * 3.5 * 4 = 70` XP for engagement alone, even if they never produced an
"answer".

### Examples

| Scenario                                        | XP  |
| ----------------------------------------------- | --- |
| 2 messages, 100% correct (2/2), 8 min, STANDARD | ~40 |
| 10 messages, 0% correct (0/2), 8 min, STANDARD  | ~22 |
| 5 engagement beats, 12 min, PRE_SYMBOLIC        | ~94 |

The first two examples confirm the acceptance criterion: a short, accurate
session beats a long, incorrect one.

## Completion-quality formula

`completionQuality` is a weighted sum of four signals, all in `[0, 1]`:

| Signal            | Weight | Definition                                            |
| ----------------- | ------ | ----------------------------------------------------- |
| `completionRate`  | 0.30   | `beatsCompleted / beatsTotal` (or `messageCount / 6`) |
| `correctnessRate` | 0.35   | `correctAnswers / attemptedAnswers`                   |
| `engagementScore` | 0.15   | `clamp(1 − 0.1 * breaksUsed, 0.3, 1)`                 |
| `timeOnTaskScore` | 0.20   | bucketed below                                        |

`timeOnTaskScore` buckets:

| Duration (min) | Score |
| -------------- | ----- |
| < 2            | 0.40  |
| 2–5            | 0.70  |
| 5–25           | 1.00  |
| 25–45          | 0.80  |
| > 45           | 0.50  |

The four-signal weighted sum is rounded to two decimals and clamped to
`[0, 1]`. The rationale is that no single dimension can dominate: a learner who
breezes through every beat in 90 seconds should not score full marks, and a
learner who spends 60 minutes producing only one answer should not either.

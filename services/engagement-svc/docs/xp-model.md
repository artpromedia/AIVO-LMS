# XP model

This document defines how XP and levels are computed in `engagement-svc`.
It exists to retire the historical synthetic formula
(`Math.round(masterySum * 5000) + 250`) that lived in the web learner
home page. That formula was a placeholder before Sprint 6 — it produced
the same number every page load even when the learner did nothing, and
it had no relationship to authored content.

## Sources of XP

Every XP grant is one row in `xp_events`, keyed by `learnerId` and
`eventType`. The new `/api/engagement/events` ingestion endpoint accepts
four event types:

| Event              | Awards XP from                                 |
| ------------------ | ---------------------------------------------- |
| `lesson_completed` | authored `payload.xp` per skill + bonus (`+5`) |
| `streak_day`       | (no XP — just streak math)                     |
| `quest_finished`   | authored `payload.xp` from the quest manifest  |
| `badge_earned`     | optional `payload.xp` from the badge manifest  |

Authored XP values live next to the content (in skill manifests / quest
configs). The service never synthesizes XP from mastery.

## Completion bonus

`lesson_completed` adds a flat `+5 XP` on top of the authored value.
Rationale: this nudges learners toward _finishing_ a lesson when the
authored XP is small (e.g. SEL reflections), without distorting the
ranking between subjects that already pay higher base XP.

## Level curve

```
xpForNextLevel(level) = level * level * 100
level(totalXp)        = floor of the largest level whose cumulative
                        sum of xpForNextLevel(1..level-1) ≤ totalXp
```

This is implemented in `routes/xp.ts::calculateLevel`. The curve is
quadratic so each level takes meaningfully longer than the last — early
levels celebrate getting started, later levels gate badge rarity.

## Streak math (timezone-aware)

A streak day is the IANA-timezone day boundary computed in the
learner's local timezone (`Intl.DateTimeFormat` with `en-CA` formatter
so the parts come out as `YYYY-MM-DD` regardless of locale). Activity
on day N+1 increments; a gap of ≥ 2 days resets to 1.

The learner's TZ source order:

1. `payload.timeZone` on the inbound event (the client knows what it
   knows).
2. `DEFAULT_LEARNER_TIMEZONE` env var.
3. UTC fallback.

> **Schema note:** the long-term home for the learner's TZ is a
> `learner_profiles.time_zone` column. Adding it is a small migration —
> until then the inline payload field is the source of truth.

## Event emission

Each successful event is published to NATS at the
`ENGAGEMENT_EVENTS_TOPIC` topic (default `engagement.events`) so
downstream services (homework-svc nudges, family-svc digest) can react
without polling. Publication is fire-and-forget; failures are logged
but never roll back the DB write.

## What this replaced

Before Sprint 6, `apps/web-v2/app/learner/home/page.tsx` synthesized:

```ts
const streakDays = 0;
const levelNumber = Math.max(1, Math.round(overallAvg * 20) + 1);
const xp = Math.round(overallAvg * 5000) + 250;
```

After Sprint 6:

```ts
const engagement = getLearnerEngagement(learnerId, session.tenantId);
const streakDays = engagement?.currentStreakDays ?? 0;
const levelNumber = engagement?.level ?? 1;
const xp = engagement?.totalXp ?? 0;
```

The repo helper reads from the engagement table the BFF endpoint
`/api/bff/learners/[id]/engagement` exposes, which is the same data the
mobile client reads — so both surfaces render identical numbers.

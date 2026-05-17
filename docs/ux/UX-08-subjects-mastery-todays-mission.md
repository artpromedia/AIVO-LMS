# UX-08 — Subjects, Mastery & Today's Mission

> **Last refreshed**: 2026-05-17 — verified current. `lib/learner/today.ts → pickTodaysMission` and the `SkillMasteryLevel` word ladder (*Just starting / Growing / On track / Stretching*) are unchanged; the Subject grid + detail page citations in §2 still resolve.
>
> **Source of truth.** This document describes what is *actually* implemented in `apps/web-v2` today plus the gaps the next sprint should close. Every claim cites a file path. Anything not cited is a proposal, not a promise.
>
> **Status legend:** ✅ shipped · 🟡 partial · ⬜ planned.

## 1. Why this surface exists

The learner home is the single page every learner lands on after sign‑in. Its only job is to answer *"what should I do right now?"* with a single primary action — never a wall of choices. The Subjects and Progress surfaces sit one click away for the learner (and the parent) who wants to know *why* today's mission is what it is.

## 2. Principles

1. **One mission, one button.** The home page renders exactly one CTA: *Start today's lesson* or *Resume lesson*. No alternates above the fold.
2. **Plain-language reason.** Every recommendation carries a `learnerReason` (kid-safe) and `reason` (parent-facing). The two strings are produced by `lib/learner/today.ts` — never written inline in the page.
3. **Mastery leads with words; numbers are secondary.** The subject grid (`subjects/page.tsx:18-24`) renders only the `SkillMasteryLevel` word (*Just starting / Growing / On track / Stretching*). The subject **detail** page (`subjects/[subjectId]/page.tsx`) currently also shows the underlying score as `… · 87 %` next to the level word; that is a deliberate concession for older learners who asked for the number. Confidence (`SkillMastery.confidence`) is never shown on any learner surface.
4. **No fake progress.** Subjects that have no mastery data yet say so and route to baseline; they do not display 0 % bars.

## 3. The mission picker (✅)

`apps/web-v2/lib/learner/today.ts` is the single source of truth. The picker walks an ordered priority list and returns either a `TodayMissionPlan` or a structured blocker.

| Step | Source | Condition | `kind` | `source` |
|---|---|---|---|---|
| 1 | Resume in‑progress run | any `LessonRun` with status `ready` or `in_progress` | `resume_in_progress` | run's own source |
| 2 | Teacher assignment | first uncompleted `TeacherAssignment` for the learner | `subject_path` | `teacher_assigned` |
| 3 | Baseline follow‑up | path node where `kind = first_skill` | `baseline_followup` | `baseline_followup` |
| 4 | Spaced review | path node where `kind = review` | `review` | `review` |
| 5 | Next unmastered | path node where `kind = next_unmastered` | `next_unmastered` | `subject_path` |
| 6 | Stretch | path node where `kind = stretch` | `subject_path` | `subject_path` |
| 7 | Fall‑through | every node completed → revisit last node | `subject_path` | `subject_path` |

### Two intentional bends in the brief's priority order

These are **shipped behavior** (`today.ts` lines 120–170), not bugs — call them out in any redesign:

1. **Teacher assignments are hoisted above the baseline blocker.** The brief puts teacher work at slot 7, after path‑based picks. The picker promotes it to slot 2 because a teacher may legitimately assign work to a learner who hasn't finished their baseline. Without the hoist, those learners would see *"Finish the baseline first"* even when their teacher has set work for them today.
2. **Quest and parent‑assigned slots are deferred stubs.** The brief lists "continue active quest lesson" (Sprint 16) and "parent‑assigned lesson" (Sprint 14) in the priority list. `today.ts` line 120 explicitly skips the quest step; parent‑assigned is not wired. Today, a learner mid‑way through a quest will see a path pick on the home card, not the quest chapter. The quest tab is the entry point for quest work; the home picker does not yet bridge to it.

### Blockers

When the picker returns `ready: false`, the home page renders an amber card with the literal copy below (`learner/home/page.tsx` lines 181–197):

| Blocker | Copy |
|---|---|
| `no_baseline` | *"Finish the baseline first."* |
| `no_path` | *"Your learning path isn't ready yet."* |
| `generation` | *"We had trouble preparing the lesson. Try again."* |
| anything else | *"Setup is almost done."* |

Parents additionally see a *Open setup* button that deep‑links to `/parent/learners/[learnerId]`.

## 4. Sitemap (shipped today)

```
/learner/home                              ✅ Today's Mission card (this doc)
/learner/subjects                          ✅ Subject grid; per-subject mastery word
/learner/subjects/[subjectId]              ✅ Subject detail (skills list + recommended next)
/learner/missions                          🟡 Mission history list (no detail view)
/learner/progress                          ✅ Mastery view (parent-readable %, learner-safe words)
/learner/rewards                           ✅ XP / streaks / badges (engagement)
/learner/library                           🟡 Static placeholder grid
```

Parent‑side mirrors live at `/parent/learners/[learnerId]/*` and reuse the same repo calls.

## 5. Screen — `/learner/home` (✅)

Source: `apps/web-v2/app/learner/home/page.tsx` (212 lines).

### Layout

1. **Eyebrow + greeting** — *"Today"* / *"Hi, {displayName}!"* (PageHeader).
2. **Parent banner** (parent role only) — *"You're viewing the learner experience for {name}."* with a *Switch learner* action.
3. **Tutor card** — `LearnerAvatar` + tutor persona name (currently hard‑coded *"Nimbus"* with the persona style from `brain.state.tutorPersonaRecommendation`). Falls back to *"Friendly and patient."* when no persona is set.
4. **Mission card** — `Badge` for subject + estimated minutes, `<h3>` skill name, `<p>` `learnerReason`, **one** primary button.
5. **Progress card** — secondary, soft‑variant *View progress* link to `/learner/progress`.

### Server action `startMissionAction`

Lines 30–81 of `home/page.tsx`. Every line below is enforced server‑side and audited:

1. Re‑authorize `learnerId` against the session (`requirePageRole(['learner','parent'])`). Learners can only start their own; parents must match the `active-learner` cookie.
2. Check `hasLearnerConsent(tenantId, learnerId, ['child_data_collection','ai_personalization'])` — fails to `?blocker=consent`.
3. Consume one token from `RATE_LIMITS.AI_GENERATION` keyed by `userId:today.start`.
4. Re‑run `pickTodaysMission` (cookie state may have changed).
5. If `existingRunId`, redirect to the resume URL directly — do **not** create a new run.
6. Otherwise call `createLessonRun({learnerId, tenantId, subjectId, skillId, source, sourceRefId})` and redirect to `/learner/lesson-runs/[id]`.
7. `audit(session, "today.start", "page-action", { lessonRunId, missionKind, source })`.

### Microcopy (verified strings)

| Surface | String |
|---|---|
| Resume button | *"Resume lesson"* |
| New-run button | *"Start today's lesson"* |
| Tutor fallback | *"Friendly and patient."* |
| Resume reason (both) | *"Pick up where you left off in {subject}."* |
| Baseline follow‑up parent reason | *"Start with {skill} in {subject} — your baseline showed we'll build confidence here first."* |
| Baseline follow‑up learner reason | *"Today we'll start in {subject}. Small steps, you've got this."* |
| Review parent reason | *"Quick review of {skill} in {subject} to keep it fresh."* |
| Review learner reason | *"A short {subject} review to keep it sharp."* |
| Stretch learner reason | *"A small {subject} challenge — you're ready."* |
| Teacher‑assigned learner reason | *"Your teacher set this for today: {title}."* |

## 6. Screen — `/learner/subjects` (✅)

Source: `apps/web-v2/app/learner/subjects/page.tsx` (88 lines).

- Grid of subject cards (3 columns on `lg`, 2 on `sm`).
- Each card shows: name, description, `Badge` with mastery word (table below), full‑width *Open {subject}* button.
- When `getMasteryMap` returns no map, the whole grid is replaced by an `EmptyState` that routes to `/learner/baseline`.

### Mastery word mapping (✅ shipped, `subjects/page.tsx:18-24`)

| `SkillMasteryLevel` | Learner-facing word | Badge tone |
|---|---|---|
| `not_started` | *Not started yet* | neutral |
| `emerging` | *Just starting* | primary |
| `approaching` | *Growing* | primary |
| `on_grade_level` | *On track* | primary |
| `stretching` | *Stretching* | primary |

Confidence (`SkillMastery.confidence` 0..1) is **never** rendered on learner surfaces. It is available on parent/teacher views.

## 7. Screen — `/learner/subjects/[subjectId]` (✅)

- Lists every skill in the subject.
- For each skill: a card with the skill name and mastery word (plus the numeric % per principle #3). Skill cards are **read-only**; there is no per-skill *Practice this* button. The only CTA on this page is a single top-of-page **Start lesson** button (line 117) that routes to the next unmastered skill via the today engine.
- Boss/quest cross‑links: 🟡 not wired in this build — call out as a UX‑09 dependency.

## 8. State matrix

| State | Trigger | Home render |
|---|---|---|
| No baseline | `getMasteryMap` returns `{ map: null }` | Amber card *"Finish the baseline first."* |
| No path | Baseline complete but `LearningPath.nodes` empty | Amber card *"Your learning path isn't ready yet."* |
| Generation failed | `createLessonRun` returned `{ ok: false }` | Amber card *"We had trouble preparing the lesson. Try again."* |
| Consent missing | `hasLearnerConsent` failed | Redirect to `/learner/home?blocker=consent` |
| Rate limited | Token bucket empty | Redirect to `/learner/home?blocker=rate_limit` |
| Ready, resume | `existingRunId !== null` | Mission card with *Resume lesson* button |
| Ready, new | Path/teacher pick succeeded | Mission card with *Start today's lesson* button |

## 9. Accessibility (verified)

- Single primary action on the mission card — no competing CTAs above the fold.
- `LearnerAvatar` exposes the name as an `aria-label` (see `components/learner/learner-avatar.tsx`).
- `Badge` components use semantic `<span>` with text, not color‑only signaling.
- The mission card respects density tokens (`var(--aivo-density-card-pad)`), so the same component reads correctly in *Comfortable* and *Compact* modes from UX‑05.

## 10. Engineering handoff

| Concern | Where |
|---|---|
| Picker algorithm | `apps/web-v2/lib/learner/today.ts` |
| Mastery snapshot | `apps/web-v2/lib/learner/mastery.ts` + `getMasteryMap` in `lib/db/repos.ts` |
| Run creation | `createLessonRun` in `lib/db/repos.ts` |
| Consent gate | `lib/bff/consent-guard.ts` |
| Rate limit | `lib/bff/rate-limit.ts` (`RATE_LIMITS.AI_GENERATION`) |
| Audit trail | `lib/bff/audit.ts` action `today.start` |

## 11. Acceptance criteria — honest

- ✅ Learner sees exactly one CTA on `/learner/home` when a mission is available.
- ✅ Picker returns the same mission across a refresh until it's started.
- ✅ Started runs surface as *Resume* on the next visit and do **not** spawn a duplicate run.
- ✅ All four blockers render a non‑threatening amber card with the literal copy in §5.
- ✅ Subject grid shows mastery as words, never as bars or percentages, on the learner role.
- ✅ Parent role sees a *Switch learner* affordance and the *"You're viewing…"* banner.
- 🟡 Quest mid‑progress does not surface as today's mission (deferred stub at `today.ts:120`). UX‑09 owns the bridge.
- ⬜ Parent‑assigned lessons do not surface as today's mission. The slot exists in the priority spec but is not wired.

## 12. Open questions

1. When a learner has *both* a teacher assignment and a path pick, the teacher work wins. Should the path pick surface as a secondary "or work on…" card below the primary CTA, or stay strictly one‑mission‑per‑page? *Current build: strictly one.*
2. The fall‑through case (everything in path completed) re‑uses the last node with copy *"You finished the path! One more pass for fun."* — verify with the curriculum team this matches the desired tone for stretch learners.

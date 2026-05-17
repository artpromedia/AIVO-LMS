# UX-09 — Quest Worlds & Homework Helper

> **Last refreshed**: 2026-05-17 — verified current. Quest types in `lib/db/types.ts`, repo helpers in `lib/db/repos.ts`, the `app/learner/quests/**` routes, and the `app/learner/homework/**` chat helper still match this doc. The quest → real `LessonRun` bridge described in §1 still resolves through `createLessonRun`.
>
> **Source of truth.** Grounded in `apps/web-v2/lib/db/types.ts` (lines 678–734), `apps/web-v2/lib/db/repos.ts`, `app/learner/quests/**`, `app/learner/homework/**`, and the matching BFF routes under `app/api/bff/learners/[learnerId]/{quests,homework}/`.
>
> **Status legend:** ✅ shipped · 🟡 partial · ⬜ planned.

## 1. Why these two surfaces are paired

They are the learner's two **opt‑in** experiences. Today's Mission is *what the system thinks you should do*; Quests are *what you choose to do for fun*; Homework Helper is *what your real‑world homework dragged in*. Pairing them in one doc keeps the engagement vs. just‑in‑time‑help boundary clear: a Quest chapter is a real `LessonRun` with curriculum signal; a Homework Helper session is a guided chat that may *optionally* spawn a follow‑up run.

## 2. Principles

1. **Quests are real lessons, not minigames.** Every chapter resolves to a `LessonRun` keyed on `skillIds[0]`, so mastery signal lands in the same place as path‑driven lessons (`types.ts:692-693`).
2. **Boss chapters unlock on completion, not on guessing.** Unlock math is server‑authoritative via `isQuestChapterUnlocked` (`learner/quests/[worldId]/page.tsx:60`).
3. **Homework Helper guides, never solves.** Tutor messages carry a `guidedOnly` flag that is set on responses that intentionally withhold the final answer (`types.ts:716`).
4. **A homework session ends with a learning insight, not a leaderboard.** On complete, `HomeworkHelpSession.insight` captures *what the learner practiced* in plain language and may attach an optional `followUpRunId`.

## 3. Sitemap (shipped today)

```
/learner/quests                                 ✅ Quest world list with chapter counts
/learner/quests/[worldId]                       ✅ Chapter map; locked chapters non-interactive
/learner/quests/[worldId]/chapters/[chapterId]  ✅ Thin start route (no intro UI) → server-starts the chapter and redirects to /learner/lesson-runs/[id]; renders a recovery card only on lock/failure
/learner/homework                               ✅ Start a session + recent sessions list
/learner/homework/[sessionId]                   ✅ Chat surface; complete returns to /learner/homework

# BFFs (✅ all wired)
GET  /api/bff/learners/[id]/quests
GET  /api/bff/learners/[id]/quests/[worldId]
POST /api/bff/learners/[id]/quests/[worldId]/chapters/[chapterId]/start
POST /api/bff/learners/[id]/quests/[worldId]/chapters/[chapterId]/complete
GET  /api/bff/learners/[id]/quests/[worldId]/progress
GET  /api/bff/learners/[id]/homework
POST /api/bff/learners/[id]/homework
GET  /api/bff/learners/[id]/homework/[sessionId]
POST /api/bff/learners/[id]/homework/[sessionId]/message
POST /api/bff/learners/[id]/homework/[sessionId]/complete
```

## 4. Quest data shapes (✅)

From `types.ts:678-708`:

```ts
QuestWorld   { id, slug, name, description }
QuestChapter { id, questWorldId, order, title, description,
               skillIds, subjectId, isBoss, prerequisiteChapterIds }
QuestProgress { learnerId, questWorldId, chapterId, tenantId,
                progress (0..1), updatedAt }
```

Notes:

- `prerequisiteChapterIds` is the **only** unlock signal. The UI must not back‑compute unlock from chapter order; the seed can place a boss anywhere.
- Progress is per‑chapter, 0..1, written by the *lesson completion* path (Sprint 16), not by the chapter page itself.

## 5. Screen — `/learner/quests` (✅)

Source: `learner/quests/page.tsx` (98 lines).

- Grid of world cards, 2 columns on `md`+.
- Each card: world name, description, **{done}/{total}** badge counting non‑boss chapters with progress ≥ 1.
- Boss footer text:
  - If beaten: *"Boss defeated"* with `tone="success"`.
  - If not: *"Boss unlocks after {n} chapter{s}"* where `n = boss.prerequisiteChapterIds.length`.
- Empty seed: *"No quests are available yet. Check back soon!"*

## 6. Screen — `/learner/quests/[worldId]` (✅)

Source: `learner/quests/[worldId]/page.tsx` (110 lines).

- Vertical list of chapters in `order`.
- Each chapter card shows: *Chapter {order}* (or *Chapter {order} · Boss*), title, description, status badge.
- **Locked chapters render as a `<li aria-disabled="true">` with `opacity-60` and no `<Link>`.** Tapping does nothing; this is the visual signal *and* the keyboard signal.
- **Done chapters** show a green *Done* badge.
- **Unlocked & not done** are anchor‑wrapped to `/learner/quests/[worldId]/chapters/[chapterId]`.

### Server enforcement

`isQuestChapterUnlocked` is called **both** in the page (for UI state) and in the `start` BFF (`start/route.ts`). Stripping the `aria-disabled` in DevTools and POSTing the start endpoint anyway returns a 403‑class error — the unlock is not client trust.

## 7. Screen — `/learner/quests/[worldId]/chapters/[chapterId]` (✅)

Source: `quests/[worldId]/chapters/[chapterId]/page.tsx`. **There is no intro screen.** This route is a thin server page that calls `startQuestChapter` directly and either:

- **Success** → redirects to `/learner/lesson-runs/[id]` (the lesson player). The learner never sees this URL.
- **Locked / not-found / failed** → renders a recovery card with the server-returned `result.message`, plus two buttons: *Back to chapter map* (soft) and *All quests* (primary). PageHeader copy: *"Quest" / "{world.name}" / "We couldn't start this chapter yet."*

On chapter completion **the lesson run is the authority**: `POST /api/bff/lesson-runs/:id/complete` derives the outcome from recorded interactions and calls `upsertQuestProgressFromCompletion`, which is what actually writes `QuestProgress`. The chapter-scoped `POST …/chapters/[chapterId]/complete` BFF is a read-only progress surfacer that asserts the latest quest `LessonRun` for `(learner, chapter)` is `status === "completed"` (returning **412** otherwise — closes the fake-completion bypass) and then returns the `QuestProgress` snapshot. After completion, `pickTodaysMission` will *not* re-surface this chapter (`today.ts:182-205` filters completed `sourceRefId`s).

## 8. Homework Helper data shapes (✅)

From `types.ts:711-734`:

```ts
HomeworkHelpMessage  { id, role: "learner" | "tutor", text,
                       guidedOnly?: boolean, occurredAt }
HomeworkHelpSession  { id, learnerId, tenantId, topic,
                       subjectId | null,        // classified from topic when possible
                       messages[], insight | null,
                       followUpRunId | null,
                       startedAt, endedAt | null }
```

## 9. Screen — `/learner/homework` (✅)

Source: `learner/homework/page.tsx` (78 lines).

- **PageHeader** copy is intentional and approved: *"Stuck on something?"* / *"Tell me what you're working on. I'll guide you — I won't just hand you the answer."*
- `<StartHomeworkForm>` (client component, `learner/homework/start-form.tsx`) — label *"What do you need help with?"*, a `<textarea rows={3} maxLength={500}>` with placeholder *"e.g. I have to add 27 + 14 and I don't know how to carry"*, primary button **Get help** (label flips to *"Starting…"* during submit). Posts to `POST /api/bff/learners/[id]/homework`, which classifies subject, creates the session, and routes to the session URL. Empty/whitespace topic shows inline error *"Please describe what you're working on."*
- **Recent sessions** (last 10) — each tile shows topic + start time + a `Done` / `Open` badge.

## 10. Screen — `/learner/homework/[sessionId]` (✅)

Source: `learner/homework/[sessionId]/page.tsx` + `chat.tsx`.

The server page renders the PageHeader with the session topic and then branches:

- **Active session** (`endedAt === null`) → `<HomeworkChat>` client component. Conversation thread of `initialMessages` with optimistic local appends after each successful send. Tutor messages carry the `HomeworkHelpMessage.guidedOnly` flag in data; **the current chat UI does not yet render a visible tag for `guidedOnly`** — that tag is a proposed addition, see §13. Empty composer is treated as no-op (silent return). Errors surface inline (e.g. *"Couldn't send. Try again."*, *"Network problem. Try again in a moment."*). The chat auto-scrolls to the latest message on every change.
- **Ended session** (`endedAt !== null`) → a *Session summary* card: heading *"Session summary"*, body = `hw.insight`, and a soft button *"Start a new session"* linking back to `/learner/homework`. The composer is not rendered.
- **End session** action in the active chat posts `complete`. On success the server writes the `insight` and (optionally) a `followUpRunId`; the client calls `router.refresh()`, which re-renders the same URL into the *Session summary* card above.

### Completion summary (parent‑facing copy)

`HomeworkHelpSession.insight` is rendered on the parent view at `/parent/learners/[learnerId]/homework/[sessionId]` (already wired, see `app/parent/learners/[learnerId]/homework/page.tsx`). Sample copy template (write it in the BFF, not the page): *"{Learner} worked on **{topic}** for {n} turns. They practiced {skill_summary}. Suggested next: a {duration}‑minute lesson on {recommended_skill}."*

## 11. Microcopy (verified strings)

| Surface | String |
|---|---|
| Quest list header | *"Pick a quest"* / *"Every chapter is a real personalized lesson. Finish all the chapters to unlock the boss."* |
| Empty worlds | *"No quests are available yet. Check back soon!"* |
| Boss locked | *"Boss unlocks after {n} chapter(s)"* |
| Boss done | *"Boss defeated"* |
| Locked chapter badge | *"Locked"* |
| Done chapter badge | *"Done"* |
| Homework start label | *"What do you need help with?"* |
| Homework header | *"Stuck on something?"* / *"Tell me what you're working on. I'll guide you — I won't just hand you the answer."* |
| Homework topic placeholder | *"e.g. I have to add 27 + 14 and I don't know how to carry"* |
| Homework start button | *"Get help"* / *"Starting…"* (during submit) |
| Homework empty-topic error | *"Please describe what you're working on."* |
| Homework send error | *"Couldn't send. Try again."* / *"Network problem. Try again in a moment."* |
| Ended-session card heading | *"Session summary"* (body = `hw.insight`) |
| Ended-session secondary | *"Start a new session"* |
| Empty recent sessions | *(section hidden)* |

## 12. State matrix

| Screen | State | UX |
|---|---|---|
| Quest list | 0 worlds | Empty card |
| Quest list | World with no boss | No boss footer text |
| Quest world | Chapter locked | Card dim, no link, *Locked* badge |
| Quest world | Chapter done | Card normal, *Done* badge |
| Quest world | All chapters done, boss locked | Should be impossible — boss `prerequisiteChapterIds` covers them. If it happens, surface a diagnostics card in dev only. |
| Chapter | Start failed (`locked` / `chapter_not_found` / `lesson_failed`) | `startQuestChapter` returns the failure class to the server page, which renders the recovery card from §7 with the server-returned message and two buttons — *Back to chapter map* (soft) and *All quests* (primary). There is no inline *Try again* button on this surface; the user retries by re-entering the chapter from the map. |
| Homework start | Topic empty / whitespace | Truly-empty input is blocked by the textarea's `required` attribute (browser-level). Whitespace-only is caught client-side before any POST and surfaces inline error *"Please describe what you're working on."* The submit button itself is not pre-disabled on empty input — it disables only during in-flight submit (label *"Starting…"*). |
| Homework session | Tutor still responding to a send | The learner's message is appended optimistically and the composer disables (`busy` flag) until the tutor reply lands and is appended. There is **no separate animated "composing…" indicator** in the current chat UI — the disabled composer is the only signal. Adding a three-dot pending bubble is a deferred polish item. |
| Homework session | Session already `endedAt` | Composer hidden, *Session summary* card with `hw.insight` + soft *Start a new session* button |

## 13. Anti‑cheating safeguards

1. **`guidedOnly` is a tutor‑server decision** — the client cannot demote a non‑guided answer into a hint. The flag is captured on every tutor message (`types.ts:716`) and is the basis for any future *"Hint, not the answer"* badge. **Today the chat UI does not yet render that badge** — adding it is a small, high-signal change: in `chat.tsx`, when a tutor message has `guidedOnly: true`, render a *Hint, not the answer* tone-warning pill above the bubble.
2. **No paste‑the‑whole‑worksheet shortcut.** The topic textarea is `<textarea maxLength={500}>` and the BFF validates 1–500 chars (`api/bff/learners/[id]/homework/route.ts`). 500 is intentionally generous enough to describe a problem but too small to dump a whole worksheet — a parent who tries to paste a multi-problem PDF will be steered into a Subject lesson instead.
3. **Insight always references practiced skills, not a verdict.** The insight is the *educational* takeaway for the parent; it never says "the answer was X".

## 14. Engineering handoff

| Concern | Where |
|---|---|
| Quest types | `apps/web-v2/lib/db/types.ts:678-708` |
| Quest repo helpers | `getQuestWorld`, `listQuestWorlds`, `listQuestChapters`, `isQuestChapterUnlocked`, `listQuestProgressForLearner` in `lib/db/repos.ts` |
| Quest BFFs | `app/api/bff/learners/[id]/quests/**` |
| Homework types | `types.ts:711-734` |
| Homework repo helpers | `listHomeworkSessionsForLearner`, plus the create/message/complete writers in `repos.ts` |
| Homework BFFs | `app/api/bff/learners/[id]/homework/**` |
| Run bridge | Both surfaces ultimately call `createLessonRun({ source: "quest" | "homework", sourceRefId })` — mastery flows back through the same path as today's mission. |

## 15. Acceptance criteria — honest

- ✅ A learner cannot start a locked chapter — confirmed both in UI and at the BFF.
- ✅ Starting a quest chapter creates a `LessonRun` whose `source = "quest"` and whose `sourceRefId = chapter.id`.
- ✅ A completed quest chapter does **not** re‑appear as today's mission (deduped by `sourceRefId`).
- ✅ Homework sessions are listed newest‑first, capped at 10 on the entry page.
- 🟡 Tutor messages with `guidedOnly` carry the flag on the wire but do not yet render a visible hint tag in the chat UI (see §13.1).
- ✅ Completion writes an `insight`; the parent view consumes that string verbatim.
- 🟡 Mid‑quest progress does not surface on `/learner/home`. The quest slot in `pickTodaysMission` is a deferred stub (`today.ts:120`). Either UX‑09 ships the bridge or this gap stays documented.
- ⬜ The tutor "composing…" indicator is **not** implemented in `chat.tsx` today. The composer simply disables on send (`busy` flag) until the tutor reply is appended. Add a three-dot pending bubble in a follow-up if user testing flags the dead-air.

## 16. Open questions

1. Should boss chapters award an avatar item (UX‑05's avatar shop) on first defeat? Engagement service supports it; UX hasn't designed the celebration screen.
2. Homework sessions with `subjectId = null` (couldn't classify): today they still record and the parent view labels the subject as *"General"*. Confirm with curriculum whether we want an explicit *"We weren't sure of the subject"* footnote on the parent surface.

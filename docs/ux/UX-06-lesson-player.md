> Status: **draft for review** · Sprint UX-06 · scope = `/learner/lesson-runs/[lessonRunId]` (the Stage) · **Last refreshed**: 2026-05-17 (verified current — beat state machine, `GeneratedLessonPlan` types, `generateLessonPlanWithRetry`, and the 5 BFFs in `app/api/bff/learners/[learnerId]/lesson-runs/[lessonRunId]/*` are unchanged).

# Sprint UX-06 — Lesson Player UX

**Scope**: the AIVO Lesson Player at `/learner/lesson-runs/[lessonRunId]` — the most important learner-facing screen in the product. Every lesson is backed by an existing `LessonRun` (the run is created upstream by `startMissionAction`, quest-chapter start, baseline follow-up, or teacher assignment; **no run is ever created on this URL**).

**Source of truth (today)**:
- Server entry: `app/learner/lesson-runs/[lessonRunId]/page.tsx` — role/tenant guard, parent active-learner cookie match, loads `LessonRun + GeneratedLessonPlan + AccessibilityPreferences`, renders one of two views: the in-flight `<LessonPlayer>` client component, or the "generating / failed" status Card.
- Client player: `app/learner/lesson-runs/[lessonRunId]/lesson-player.tsx` — beat-by-beat state machine over a `GeneratedLessonPlan`.
- Plan + outcome types: `lib/db/types.ts` → `GeneratedLessonPlan`, `LessonStepKind`, `LessonInteraction`, `LessonOutcome`, `ParentLessonSummary`.
- Lesson generation: `lib/ai/tutor.ts` → `generateLessonPlanWithRetry`; called by `lib/db/repos.ts` `createLessonRun` and the `/retry` BFF.
- BFFs: `app/api/bff/learners/[learnerId]/lesson-runs/[lessonRunId]/{route,start,step,complete,retry}/route.ts`.
- Mental model: **one beat at a time**. The Stage is the dominant element — no sidebar, no secondary actions, just the active beat + the tutor's voice + a primary "next" button.

Status legend: ✅ shipped · 🟡 partial · ⬜ planned.

---

## 1. Principles

1. **One beat at a time, no clutter.** Each beat is rendered as a single Card with the beat's body, the tutor presence (when relevant), and exactly one primary action (Continue / Next / Submit / I'm done). The progress bar + beat counter is the only persistent chrome.
2. **Friendly tutor presence.** Beat 1 (`welcome`) leads with `plan.tutorGreeting` and the `<TutorBadge>`. Tutor identity carries through subtle motifs (color accent + persona icon) on guided practice + checks so the learner feels accompanied.
3. **Large text, large buttons.** All beats use the learner-mode density tokens (≥ 18px body, ≥ 56px primary button). Touch targets ≥ 44×44px. Spec mirrors UX-05 §1.3.
4. **Supportive correction, not shame.** No "Wrong." After an incorrect answer the player shows soft inline support copy — on guided beats: "Not quite — try again or use the hint. {scaffold}" (Check stays enabled so the learner can edit + Check again); on check beats: "Close — {supportIfWrong}" (Check is single-shot, the lesson continues with the wrong answer recorded). Never red flash, never "incorrect" word. (Microcopy table §6.)
5. **Autosave + resume must feel seamless.** Beat index is mirrored to `?step=` in the URL; refresh restores the exact beat. Each beat enter fires `POST /step` so the server has an audit-trail record of every beat the learner reached. `LessonRun` rows persist across sessions; the run is opened in whatever status it was last in.
6. **Accommodations are first-class layout, not a setting.** Read-aloud, hint, scaffold, take-a-break are visible affordances on the active beat — not buried in a menu. Each is one tap.
7. **Honor accessibility prefs.** `AccessibilityPreferences` is passed to the client component and gates: `reducedMotion` (disables beat transitions), `largeText` (bumps base to 20px), `dyslexiaFont` (swap font family), `highContrast` (forces high-contrast palette), `shorterSteps` (drops the `story` beat from the sequence). All five are wired today via wrapper classes.
8. **Lesson Player is the only screen that wholly hides `LEARNER_NAV`** — wait, that's not true today. **Today the Stage still renders inside `<AppShell navItems={LEARNER_NAV}>`**, which means the sidebar/header are still present. Hiding chrome for an immersive single-task experience is ⬜ planned (§8.1).

---

## 2. Beat sequence (canonical — matches `buildBeats()` in `lesson-player.tsx`)

| # | Beat `kind` | Source | Required actions | Notes |
|---|---|---|---|---|
| 1 | `welcome` | `plan.tutorGreeting` | Continue | Tutor entry; carries `<TutorBadge>`. |
| 2 | `goal` | `plan.objective` | Continue | One-sentence goal in plain language. |
| 3 | `story` | `plan.storyHook` | Continue | **Dropped when `shorterSteps` accommodation is on.** |
| 4 | `micro` | `plan.microLesson` | Continue | The teaching moment. |
| 5 | `example` | `plan.example.prompt + .explanation` | Continue | Worked example. |
| 6..N | `guided` (per item) | `plan.guidedPractice[i]` | Submit answer + (optional) Hint + Scaffold | Choices radio OR free-text. `isCorrect` compared via `normalizeAnswer()`. No skip on guided beats today. |
| N+1..M | `check` (per item) | `plan.checksForUnderstanding[i]` | Check (single-shot) + Next | After a wrong answer, `supportIfWrong` shown inline ("Close — …"); the Check button is then disabled (no retry today). Next advances. |
| M+1 | `celebrate` | `plan.encouragement` | Continue | Confetti gated by `!reducedMotion`. |
| M+2 | `progress` | `plan.parentSummary` (rendered learner-safe) | Continue | Show what was mastered + 1-line take-away. |
| M+3 | `next` | `plan.nextRecommendedStep` | "I'm done" → `POST /complete` | Final beat; submission carries `LessonOutcome`. |

Sequence length is dynamic — guided practice + checks counts come from the plan. Typical run = ~12–18 beats. `welcome → next` is the canonical order; `shorterSteps` is the only short-circuit today.

---

## 3. Status states (server-side)

`LessonRunStatus` is `generating | ready | in_progress | completed | failed | abandoned` (see `lib/db/types.ts`). The page-level server component has **one explicit branch** today:

```ts
if (!plan || lessonRun.status === "generating" || lessonRun.status === "failed") {
  // → status Card (PageHeader + Card + Badge(status) + failureReason + Back-to-today)
} else {
  // → <LessonPlayer initialStatus={lessonRun.status}>
}
```

| `LessonRun.status` (or plan state) | Server renders today |
|---|---|
| `generating` (or plan absent) | ✅ "Getting your lesson ready…" Card + `Back to today` button. No auto-refresh; parent reloads manually. |
| `failed` | ✅ "We hit a snag preparing this lesson" Card + `failureReason` (red) + `Back to today`. ⬜ Retry — `POST /retry` BFF exists but no UI button surfaces it; today the only escape is back-home and re-pick (§8.2). |
| `ready` / `in_progress` / `completed` / `abandoned` | All four fall into the `<LessonPlayer>` else-branch. The client component reads `?step=` to restore beat index for in-progress runs. `completed` and `abandoned` runs **today are not explicitly handled by the server page** — they render the player with `initialStatus` set, and the player walks beats from the URL `?step=` (or 0). 🟡 Cleanup: server page should branch on `completed` (show celebration-only view) and `abandoned` (redirect to `/learner/home` with a banner) — §8.6. |

---

## 4. Beat-level UX spec

### 4.1 Linear narrative beats (welcome / goal / story / micro / example / celebrate / progress / next)

- **Layout**: `<PageHeader>` (eyebrow = "Lesson", title = beat title, description = `learnerReason` carried from the mission) → `<Card>` with the beat body in display font 24–28px + `<Progress>` bar + persistent footer with Hint · Read-aloud · Break.
- **Primary action**: a single `<Button size="lg">` labeled "Continue" (or "Got it" for `micro`/`example`, "Let's try" before the first `guided`, "I'm done" on the final beat). Enter + Space activate.
- **Tutor presence**: `<TutorBadge>` in the header on `welcome` only; the tutor accent stays on the active beat outline through the rest.

### 4.2 Guided practice beat

- **Card body**: `prompt` (display 22px). If `choices` present, a `<fieldset><legend class="sr-only">` then radio options as large tap targets. Otherwise free-text input (`<input type="text">` size large).
- **Footer affordances** (visible by default — not hidden in a menu):
  - **Hint** button (`variant="soft"`) → reveals an inline "Hint: …" line below the prompt with `plan.guidedPractice[i].hint`; usage is captured in the `LessonOutcome.hintsUsed` counter. ✅ shipped via `requestHint()` + `showHint` state.
  - **Scaffold** button (`variant="ghost"`) → reveals the deeper `scaffold` copy; captured in `scaffoldsUsed`. ✅ shipped via `useScaffold()`.
  - **Break** button → flips the player into a full-Card "Break" view (`eyebrow="Break"`, body with calm copy, "I'm ready to keep going" button to return to the same beat); the `secondsActive` timer is paused (the `useEffect` that posts the per-beat step is gated by `!onBreak`). ✅ shipped via `setOnBreak`.
  - **Read-aloud** button → ⬜ not rendered today. The `aria-live` region on each beat lets a screen reader announce the body, but there is **no on-screen Read-aloud button** and no TTS wiring. Adding it is §8.3.
- **Submit + advance** (two-button flow today):
  - The **Check** button calls `submitAnswer()`, which compares via `normalizeAnswer()` and sets local `feedback` state to `"correct"` or `"incorrect"`. On correct: a green inline "Nice work!" line. On incorrect: a rose-tinted line "Not quite — try again or use the hint. {beat.scaffold}" — the beat's `scaffold` copy is surfaced inline as the support framing (the `hint` text only appears if the learner explicitly opened it via the Hint button, which is rendered alongside Check + a separate "Show me how" Scaffold button). On a guided beat, **Check stays enabled** so a learner can edit the input + Check again (no formal retry loop). Enter on the input also triggers Check.
  - The **Next** button (always visible at the bottom of an interactive beat) is `disabled` until `feedback !== null` — i.e. the learner must Check at least once before Next is unlocked. Next calls `advance()` which increments the beat index. There is no "Submit advances on correct" auto-progression today.
- **Answer normalization**: `normalizeAnswer()` lowercases + strips non-alphanumeric Unicode. Open-ended responses (no `expectedAnswer`) accept any non-empty answer.

### 4.3 Check-for-understanding beat

Same shape as guided practice except:
- **No hint button** (a check is a check).
- **Check is single-shot**: the Check button becomes `disabled` once `feedback !== null`. There is no `Try again` button today — the result is final for `LessonOutcome.checksCorrect / checksTotal`. The Next button then unlocks. On `incorrect`, the beat's `supportIfWrong` copy appears inline as the support framing before moving on.
- Adding a true retry loop (or a "review and retry" affordance) on a wrong check is ⬜ — today the brief's "Incorrect answer with support" state is partially shipped (supportive copy yes, retry on the same question no — the lesson moves forward with the wrong answer recorded).

### 4.4 Final "next" beat → `POST /complete`

- **Primary action**: `<Button size="lg">I'm done</Button>` → calls the complete BFF.
- **Payload today** (per `complete()` in `lesson-player.tsx`): the client posts only `{ outcome: { abandoned: false } }`. The server derives `checksTotal / checksCorrect / hintsUsed / scaffoldsUsed / secondsActive` from the `LessonInteraction` rows that the per-beat `POST /step` calls have been writing all along (those step posts carry `stepKind` + `response` + `isCorrect`, so the aggregate is reproducible server-side). The client-side `hintsUsed`/`scaffoldsUsed` counters in the player are a UX signal only and are not sent to the server. The "Take a break and leave" button on the Break view posts the same endpoint with `abandoned: true`.
- On success → redirect to `/learner/home`. The redirect feeds the next pick from `pickTodaysMission` (UX-05 §3 "resume" branch will not fire because the run is now `completed`).
- The parent summary is generated server-side from the derived outcome + plan; the next time the parent visits `/parent/learners/[id]/lessons` or `/parent/learners/[id]/summary` they'll see a `<ParentLessonSummary>`.

---

## 5. State matrix (Lesson Player)

| State | UI behavior | Recovery |
|---|---|---|
| **Lesson generating** | Server: status Card "Getting your lesson ready…" + Back-to-today. Auto-refresh ⬜ (today the parent reloads). | `Back to today` |
| **Lesson ready** | Player renders `welcome` beat, `?step=` defaults to 0. | n/a |
| **Lesson in progress** | Player restores beat via `?step=` URL param. | n/a (refresh-safe) |
| **Step complete** | Beat advances; `POST /step` audit. | n/a |
| **Incorrect answer with support** | 🟡 On guided: rose-tinted inline line "Not quite — try again or use the hint. {beat.scaffold}" — the **scaffold** copy is what's inlined; the beat's `hint` text only appears if the learner explicitly opens the separate Hint button. Check stays enabled so the learner can edit the answer + Check again before Next unlocks. On check beats: inline "Close — {supportIfWrong}" + Check button is disabled (single-shot); the wrong answer is recorded for `checksCorrect/Total` and Next advances the lesson. ⬜ A true "review and retry" loop on a wrong check is not shipped. |
| **Hint opened** | ✅ Inline "Hint: …" line appears under the prompt; Hint button becomes disabled; `hintsUsed++`. Hint stays visible until the next beat. |
| **Scaffold opened** | ✅ Inline scaffold copy appears; `scaffoldsUsed++`. Stays visible until the next beat. |
| **Read-aloud active** | ⬜ Not rendered today — no Read-aloud button, no TTS wiring. The beat container has `aria-live` so screen readers announce it. |
| **Break mode** | ✅ Full-card Break view (eyebrow "Break", calm copy, "I'm ready to keep going" CTA + a "Take a break and leave" CTA that posts `complete({abandoned: true})`). Break is **client-only state** (`setOnBreak`) — no separate step-post fires when entering or leaving break; the `secondsActive` timer and the per-beat step-post `useEffect` are gated by `!onBreak`. |
| **Connection interrupted** | 🟡 today **asymmetric**: per-beat `POST /step` calls (and the per-action hint/scaffold step posts) are fire-and-forget (`.catch(() => {})`) — failures are silent and the learner continues. Only `POST /complete` surfaces an error (`completeError` state). Break is local state and never hits the network. ⬜ Planned: a friendly banner "Hang on — we lost our connection. We'll save your spot." with retry-aware step posts. | for /complete: retry inline. For /step: nothing today. |
| **Autosaving** | Beat enter fires `POST /step` (fire-and-forget); ⬜ visible "Saved" pip planned, and a real retry/queue when offline. | n/a |
| **Resume available** | URL-driven; no UI prompt needed today. | n/a |
| **Lesson completed** | Final beat → `I'm done` → `/learner/home`. | n/a |
| **Lesson failed with retry** | Server status Card + `failureReason` (red) + `Back to today`. ⬜ "Try again" button hitting `POST /retry` BFF is not yet wired in UI — §8.2. | currently: back to home + parent triggers re-pick |
| **Offline resume unavailable** | ⬜ planned — service-worker cache of last-fetched plan + queue of beats; today web is online-only. | manual retry on reconnect |
| **Mobile role interrupted** | ⬜ unified mobile (UX-12 + UX-13) — parent receiving a notification mid-lesson must not auto-switch the learner out of the Stage. | role-switch confirmation |
| **Parent lock required for leaving learner mode** | ⬜ unified mobile — exit-learner-mode requires a PIN / face-unlock. | enter PIN |

---

## 6. Microcopy (the player)

Per UX-06 brief + the codebase's existing tutor copy.

| Context | Bad | Good |
|---|---|---|
| Incorrect check | "Wrong." / "Incorrect." | "Let's try another way." (rendered via `supportIfWrong`) |
| Offering hint | "Need help?" | "Here's a hint." |
| Effort framing | "You got 6 of 10 right." | "You're building this skill." |
| Encouragement on celebrate | "Done." | "Great effort." |
| Transition to next | "Click next." | "Ready for the next step?" |
| Hint not punitive | "You couldn't solve it without help." | "Hints are part of learning — you used the right tool." |
| Skip | "Question skipped." | "We'll come back to that one." |
| Break | "Lesson paused." | "Take a breath. We'll wait for you." |
| Resume after refresh | "Resuming session." | "Welcome back — picking up where you left off." |
| Lesson failed (server) | "Lesson generation failed: model_error" | "We hit a snag preparing this lesson. Try again." (already shipped) |

---

## 7. Layout per breakpoint

| Breakpoint | Treatment |
|---|---|
| **Tablet (primary, 768–1280)** | Single column. Active beat Card spans full width minus 32px gutter. Persistent footer (Hint · Scaffold · Read-aloud · Break) is bottom-anchored with 56px buttons. Progress bar at top. |
| **Desktop (≥ 1280)** | Center the Card at max-width 720px (reading-line constraint — long lines hurt comprehension); progress bar at top spans full content width. |
| **Mobile web (≤ 480)** | Single column; Card is edge-to-edge with 16px gutter; footer becomes a 2×2 grid of accommodation buttons. CTA is full-width sticky at bottom. |
| **Unified mobile Learner Mode** (UX-12+13) | Same client component embedded in the native shell; native back-gesture intercepted with a "Leave lesson?" confirm. |

---

## 8. Engineering handoff

1. ⬜ **Immersive shell variant** — render the Stage without `LEARNER_NAV` sidebar so the active beat dominates. Today the player is inside the standard `<AppShell navItems={LEARNER_NAV}>`. Add an `immersive` prop to AppShell that hides nav while preserving the role/user header + the back-to-home affordance (with a confirm to prevent accidental exit).
2. ⬜ **`Try again` button on failed-status Card** — wire `POST /api/bff/learners/[learnerId]/lesson-runs/[lessonRunId]/retry` so a failed generation can be re-triggered from the failed-status Card without going back to `/learner/home` and re-picking.
3. ⬜ **Read-aloud button + TTS playback** — today there is **no on-screen Read-aloud control** in the player (only `aria-live` for screen readers). Add a Read-aloud button to the active beat's footer and wire it to TTS using the learner's `audioPreferences` (voice + rate).
4. ⬜ **"Saved" indicator** — a small pip near the progress bar that animates briefly when `POST /step` succeeds, gated by `!reducedMotion`. Today step posts succeed silently.
5. ⬜ **Connection-interrupted banner + retry-aware step posts** — today `POST /step` (and the per-action hint/scaffold step posts) are `.catch(() => {})` — silent on failure. Only `POST /complete` surfaces an error. Wrap step + complete calls in a retry-aware handler; on transient failure show "Hang on — we lost our connection." with auto-retry + manual-retry CTA so the per-beat audit trail isn't silently lost.
6. 🟡 **Explicit `completed` + `abandoned` server branches** — `LessonRunStatus` includes both today, but the server page does not branch on them; the client player handles them by rendering the final beats (for `completed`) or whatever the URL `?step=` resolves to (for `abandoned`). Add server-side branches: `completed` → celebration-only summary Card; `abandoned` → redirect to `/learner/home` with a banner explaining the run was closed.
7. ⬜ **Service-worker offline shell** — cache the last-fetched plan + queue beats; sync on reconnect. This is the only path to "offline resume unavailable" → "offline resume available" for native mobile parity.
8. ⬜ **Beat-level confetti gating** — `celebrate` beat currently renders consistent visuals; `reducedMotion=true` should disable any motion/confetti while keeping the encouragement copy.
9. ✅ **Audit trail symmetry** — beat-enter posts to `/step` and includes `stepKind`; complete posts the `LessonOutcome`. Keep this pattern when adding new beat kinds.
10. ⬜ **Mobile role-interruption handling** — when a parent notification arrives mid-lesson on the unified mobile app, the learner stays on the Stage; only the parent affordances update.

---

## Acceptance criteria (per UX-06 brief)

- [x] Learner can complete a full LessonRun — beats run from `welcome → next`, complete posts `LessonOutcome` and routes home (§2 + §4.4).
- [x] Learner can request hints and scaffolds — Hint (soft) and Scaffold (ghost) buttons render on guided beats; usage feeds `hintsUsed`/`scaffoldsUsed`; inline reveal shipped (§4.2).
- [⬜] Learner can use read-aloud — no Read-aloud button rendered today; only `aria-live` screen-reader announcement (§4.2 + §8.3).
- [x] Learner can take a break — Break button flips the player into a full-Card Break view with "I'm ready to keep going" resume; `secondsActive` paused while on break (§4.2).
- [x] Learner can resume after refresh — `?step=` URL param mirrors the beat index; `POST /step` per beat persists progress server-side.
- [⬜] Learner can complete LessonRun inside unified mobile app Learner Mode — owned by UX-12 + UX-13; this doc's client component is reusable (no DOM-only dependencies), but the mobile shell + role-interruption + parent-lock are mobile-app scope.
- [x] Completion leads to progress update and next step — `POST /complete` updates mastery + writes `ParentLessonSummary`; redirect to `/learner/home` triggers the next `pickTodaysMission` (§4.4).

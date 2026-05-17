> Status: **draft for review** · Sprint UX-07 · scope = `/learner/baseline` + `/learner/baseline/[baselineId]` + `/parent/learners/[id]/baseline` · **Last refreshed**: 2026-05-17 (verified current — the "brain profile missing" precondition in §4 now resolves against the v2 `LearnerBrainProfileState`; on baseline `completeAction` the clone is finalized via `commitBrainClone`, so post-baseline mastery + the `approvalStatus` flow described in UX-04 §4.7 both kick in here).

# Sprint UX-07 — Baseline Assessment UX

**Scope**: the personalized baseline assessment — the moment the learner moves from "set up" to "ready for today's mission". Routes today:
- `/learner/baseline` — entry / readiness gate / generate-if-needed.
- `/learner/baseline/[baselineId]` — the question runner (one question at a time). Supports a parent-as-learner mode via `?as=parent`.
- `/parent/learners/[learnerId]/baseline` — parent-side status + plain-language summary post-completion.

**Source of truth (today)**:
- Server pages: `app/learner/baseline/page.tsx` (entry) and `app/learner/baseline/[baselineId]/page.tsx` (runner with `answerAction` + `completeAction` server actions).
- Types: `lib/db/types.ts` → `Baseline`, `BaselineQuestion`, `BaselineAttempt`, `BaselineDifficulty`, `BaselineSummary`.
- Repos: `lib/db/repos.ts` → `createBaseline`, `getActiveBaselineForLearner`, `getBaselineById`, `listBaselineQuestions`, `listBaselineAttempts`, `recordBaselineAttempt`, `startBaseline`, `completeBaseline`.
- BFFs: `app/api/bff/learners/[learnerId]/baseline/{route,start,answer,complete}/route.ts`.
- Generation source (per UX-07 brief): learner profile + grade band + parent assessment + IEP/accommodations + subject area + known strengths/weaknesses — synthesized into `BaselineQuestion[]` at `createBaseline` time.
- Mental model: the baseline is a **friendly check-in**, not a test. Tone is "let's see what's interesting to you" — never "let's measure what you know".

Status legend: ✅ shipped · 🟡 partial · ⬜ planned.

---

## 1. Principles

1. **Low-pressure framing.** Eyebrow says "Baseline", page title is "A quick check-in" (not "Assessment", not "Diagnostic"). Description is "A few friendly questions so your tutor knows where to start." Already shipped in `app/learner/baseline/page.tsx`.
2. **One question at a time.** No grid of questions; the runner shows the *next unanswered* question full-width. Already shipped via the `next = questions.find((q) => !answeredQids.has(q.id))` pattern.
3. **Skip is a first-class action.** Every question has a Skip button next to Submit — same visual weight, just a secondary variant. Skipping is captured (`BaselineAttempt.skipped = true`) and never penalized. Learner-safe copy: "We'll come back to that one."
4. **Hint is inline, optional, opt-in.** When `BaselineQuestion.hint` is present, it shows below the input as a soft Card with `<strong>Hint:</strong> …`. Already shipped.
5. **Read-aloud is surfaced when available.** When `BaselineQuestion.readAloudText` is set, a small "Read aloud available" chip appears with a `<Volume2>` icon. Already shipped as a chip; full TTS playback is ⬜ planned (parallel with UX-06 §8.3).
6. **No diagnostic language.** Never "test", "score", "grade level", "below grade level", "weakness", "deficit". The completion screen says "Nice work!" + the `learnerSafeSummary` line — no numbers in the learner UI.
7. **Accommodation-aware generation, accommodation-aware UI.** `BaselineQuestion.accommodationTags` (e.g. `read_aloud`, `simplified_language`, `extra_time`, `single_concept`) inform question generation and surface UI affordances; questions can be filtered or adapted per the learner's `AccessibilityPreferences`.
8. **Resume after refresh is automatic.** No `?step=` param needed — the runner always renders the next unanswered question by querying `BaselineAttempt` rows. Refresh = land back on the same question, no progress lost. Already shipped.
9. **Parent shadow mode (`?as=parent`)**. A parent can drive the baseline for a learner who isn't device-ready (younger learner, AT-using learner). The page detects `?as=parent`, requires `parentCanAccessLearner`, and routes back to `/parent/learners/[id]/baseline` on completion instead of `/learner/home`. Already shipped — see `asParent` branches in `answerAction` + `completeAction`.

---

## 2. Baseline flow (canonical)

```
/learner/home
   │  readiness === "baseline_needed"
   ▼
/learner/baseline                  (entry / readiness gate)
   │
   ├── parent assessment not submitted OR brain profile missing
   │     → EmptyState "A grown-up will set this up"
   │
   ├── no active baseline (or last one complete)
   │     → "Ready to start?" Card with `ensureBaselineAction` form
   │         → createBaseline() if needed → redirect to /[baselineId]
   │
   └── active baseline in progress
         → Continue Card → /[baselineId]
                            │
                            ▼
                    /learner/baseline/[baselineId]
                       │
                       ├── status === "complete"     → "Nice work!" + learnerSafeSummary
                       │                               + Continue button →
                       │                                   /learner/home  (or /parent/learners/[id]/baseline when ?as=parent)
                       │
                       ├── all questions answered   → "Ready to finish" → completeAction
                       │   but not yet completed         │
                       │                                 ▼
                       │                          completeBaseline()
                       │                          refreshLearnerReadiness()
                       │                          audit("baseline.complete")
                       │                          → redirect to /learner/baseline/[id]
                       │                              (or /parent/learners/[id]/baseline when ?as=parent)
                       │                              — the status===complete branch above
                       │                                then renders the "Nice work!" screen
                       │
                       └── next question pending   → render BaselineQuestion
                                                     │ (Submit OR Skip)
                                                     ▼
                                          recordBaselineAttempt()
                                          audit("baseline.answer")
                                          → redirect back to /[baselineId]
                                          (renders the next pending question)
```

---

## 3. Screen-by-screen spec

### 3.1 `/learner/baseline` (entry)

- **Purpose**: gate-keep + create-if-needed + route into the runner.
- **Readiness preconditions** (both required, checked server-side via repos):
  - `getOrCreateParentAssessment(learnerId).submittedAt` is set.
  - `getBrainProfile(learnerId)` exists.
- **Three states**:
  - **Not ready** → `<EmptyState>` "A grown-up will set this up" + "Ask the grown-up who signed you up to finish the setup." + `Back home` button. ✅
  - **No active baseline (first run, or previous completed)** → Card with the `<Play>` icon + "Ready to start?" copy + a `<form action={ensureBaselineAction}>` whose Submit creates the baseline and routes to `/[baselineId]`. ✅
  - **Active baseline in progress** → Card with progress count + `Continue` button → `/[baselineId]`. ✅
- **PageHeader**: eyebrow "Baseline", title "A quick check-in", description "A few friendly questions so your tutor knows where to start."
- **Generation explanation** (UX-07 brief — "purpose explanation" screen): rendered as a small `<Card variant="soft">` below the Start CTA on the no-active-baseline branch: "These questions are personalized for you. We use them to pick the right place to begin — there's no grade, no score." 🟡 today the explanation lives only in the description text; promoting it to a dedicated soft Card is the §6.1 backlog.
- **Server action `ensureBaselineAction`**: re-verifies the precondition pair, calls `createBaseline()` if none active, emits `audit("baseline.create", …)`, redirects to `/learner/baseline/[id]`. ✅

### 3.2 `/learner/baseline/[baselineId]` (the runner)

Single page that branches on three conditions in this order:

#### 3.2.1 `baseline.status === "complete"` — completion screen

- **PageHeader**: eyebrow "Baseline", title "Nice work!", description = `baseline.summary.learnerSafeSummary` (e.g. "You answered all the questions. Your tutor's going to pick a great place to start.")
- **Body Card**: `<CheckCircle2>` + "All done" + "You answered N of M questions."
- **Primary CTA**: `Continue` → `/learner/home` (or `/parent/learners/[id]/baseline` when `?as=parent`).
- **Notably absent**: no scores, no per-subject breakdown, no difficulty distribution. All of that lives in the parent summary. ✅

#### 3.2.2 All questions answered, not yet completed — finish screen

- **PageHeader**: eyebrow "Baseline", title "Ready to finish", description "Tap the button to send your answers."
- **Body**: `<form action={completeAction}>` with the baseline + learner ids, single `Finish baseline` button. ✅
- **Why this screen exists**: the answer flow is one-question-at-a-time; this screen is the explicit commit step rather than auto-completing on the last answer. Gives the learner agency on the final step.

#### 3.2.3 Next question pending — the runner

- **PageHeader**:
  - eyebrow: `Baseline · <SubjectName>` (subject derived from `BaselineQuestion.subjectId`).
  - title: `Question N of M` (computed from `attempts.length + 1` clamped to `questions.length`).
  - description: `For <learnerName>.` whenever a learner record loads (which is the normal case in both learner mode and `?as=parent` mode). Falls back to "Take your time. You can skip." only when no learner record is present. 🟡 The brief calls for the lower-pressure "Take your time. You can skip." copy on the learner runner — today it's shown only as a fallback. Promoting it to the primary description (and demoting "For X." to a small sub-line) is a §7 polish item.
  - actions: `<Badge tone="primary">` showing the question's `difficulty` (e.g. "warm up", "core", "stretch"). 🟡 the brief flags that we should be careful with difficulty labels on the learner card — today the runner shows `difficulty` text; consider hiding it or learner-safing it (§6.3).
- **Body Card**:
  - `prompt` in display 20–22px.
  - If `readAloudText`: `<Volume2>` chip "Read aloud available" — visible affordance, but TTS not wired today.
  - **Form** (`<form action={answerAction}>`):
    - Hidden inputs: `baselineId`, `learnerId`, `questionId`, optional `asParent=1`.
    - **Multiple-choice questions**: `<fieldset>` with `<legend class="sr-only">Choose one</legend>` + radio inputs wrapped in large tappable labels. ✅
    - **Free-text questions**: a single large text input with `placeholder="Type your answer"`. ✅
    - **Inline hint**: when `BaselineQuestion.hint` is present, a soft Card below the form with "Hint: …". ✅
    - **Submit button**: `Submit answer` (primary) + `Skip` (outline). Skip uses `formNoValidate` so the `required` constraint on the response input is bypassed; on submit `skipped="1"` is posted. ✅
- **Progress section** (below the Card): a grid of N tiny Cards, one per question, showing `01`, `02`, … with a Badge: `answered` (success tone), `skipped` (neutral tone), or `pending` (neutral tone). Each Card displays the first ~40 chars of the prompt. ✅
- **Server action `answerAction`**:
  - re-authorizes role (parent vs learner) and learner-scope match.
  - calls `assertBaselineMatchesLearner` (defense-in-depth — even though the BFF guards already check, the server-action path bypasses BFF).
  - calls `startBaseline(baselineId)` to flip the run to in-progress if it wasn't.
  - records the attempt via `recordBaselineAttempt` — the repo computes `isCorrect` against `expectedAnswer`.
  - emits `audit("baseline.answer", { baselineId, questionId, skipped, isCorrect })`.
  - redirects back to `/learner/baseline/[id]` (preserving `?as=parent` when set) — the next pending question is computed on the re-render. ✅

### 3.3 `/parent/learners/[learnerId]/baseline` (parent-side status)

Owned in detail by UX-04 §4.8; in this doc just the contract:

- **Three states** (per `app/parent/learners/[learnerId]/baseline/page.tsx`):
  - `not_started` → "Ready to start" Card with `Start baseline` form button → POSTs to `startBaselineAction` (parent server action, scoped to `parent` role + `parentCanAccessLearner` + assessment + brain-profile preconditions) → `createBaseline` if needed → `redirect("/learner/baseline/{baselineId}?as=parent")`. **The parent never hits `/learner/baseline` (the learner entry page) — that route is `requirePageRole(["learner"])` and would 401 a parent session.** The "hand the device to the learner" affordance is a copy choice; today it's framed as the parent driving the runner in shadow mode.
  - `in_progress` → status Card with "N of M answered" + `Continue baseline` link → `/learner/baseline/[id]?as=parent`. A `Restart` form button is also shipped (also POSTs to `startBaselineAction`).
  - `complete` → parent summary (§5).

---

## 4. State matrix

| State | UI | Recovery |
|---|---|---|
| **Baseline readiness gate failed** | EmptyState "A grown-up will set this up" + Back-home | parent finishes assessment/profile |
| **Baseline generating** | 🟡 today: `createBaseline` is synchronous in the repo, so no generating state surfaces in UI. ⬜ When generation moves to LLM-backed: page should show a "Building your questions…" Card with spinner | back to home if it takes too long |
| **Baseline ready** | Entry page Start Card | tap Start → enters runner |
| **Question rendered (pending)** | Runner Card | answer or skip |
| **Hint opened** | Hint Card already inline (no expand/collapse today) | scroll past — answer when ready |
| **Read-aloud available** | `<Volume2>` chip visible. 🟡 TTS playback ⬜ | n/a today |
| **Break** | ⬜ explicit Break button is not yet wired on the runner — refresh is implicit (no progress lost). Adding a "Take a break" link → calm `<EmptyState>` overlay is §6.2 backlog. | refresh / re-open |
| **Answer submitted** | Server action redirects back; next question renders. No transient celebration per-question (intentional — keeps tone low-stakes). | n/a |
| **All answered, not committed** | "Ready to finish" Card + Finish button | Finish → complete |
| **Baseline complete** | "Nice work!" Card + `learnerSafeSummary` | Continue → /learner/home or /parent/.../baseline |
| **Results processing** | ⬜ today: `completeBaseline` is synchronous; no processing wait. When async: a Card "Putting it all together…" | refresh |
| **Retry / restart** | ⬜ today there's no learner-facing "start over" — defensive (we don't want re-attempts inflating the answer count). A parent-side "Reset baseline" is the proper escape hatch and is ⬜ planned in `/parent/learners/[id]/baseline`. | parent action |
| **Mobile Learner Mode baseline** | ⬜ owned by UX-12 + UX-13; same server pages re-rendered inside the native shell. | n/a |
| **Mobile Parent Mode baseline status** | ⬜ owned by UX-12 + UX-13. | n/a |

---

## 5. Parent baseline summary

Per UX-07 brief — the parent's view of completion. Owned by UX-04 §4.8; this doc records the contract.

Surfaced from `Baseline.summary: BaselineSummary` (see `lib/db/types.ts`). The summary fields used by the parent UI:

- `parentSummary` — plain-language headline (one sentence). Example: "Sky finished their baseline. They're strongest in reading comprehension and we'll start in math with smaller steps."
- `recommendedStartSkillId` — drives the first `LearningPath` node (`kind: "first_skill"`) and therefore the first Today's Mission.
- `learnerSafeSummary` — what the learner sees on the completion screen ("You did great. You'll see what's next on your home screen.").
- `totalAnswered` / `totalQuestions` / `correctCount` — used **only** in the parent surface (never the learner UI).

Parent baseline summary surfaces (per UX-07 brief sub-bullets):
- **Baseline completed** — ✅ today: green status Card with `<CheckCircle2>` + "Baseline complete" + `baseline.summary.parentSummary` headline. (`app/parent/learners/[learnerId]/baseline/page.tsx`.)
- **Starting areas** — 🟡 today: the parent page renders a "Per subject" grid using `baseline.summary.perSubject[]` with a difficulty-estimate Badge per subject. A dedicated "Starting areas" callout naming the `recommendedStartSkillId` lesson is ⬜ (§7 polish).
- **Strengths noticed** — ⬜ today: not surfaced as a separate "what they were confident in" block. The per-subject grid is the closest equivalent.
- **Support settings used** — ⬜ today: accommodation tags that fired during the run are not summarized in the parent UI.
- **Recommended first lesson** — 🟡 today: the parent page shows a `Back to learner` CTA + a `Restart baseline` form button. A dedicated "Start the recommended first lesson" CTA derived from `recommendedStartSkillId` is ⬜.
- **No overly technical scoring** — ⬜ **violation today**: each per-subject Card shows `"{row.correct} of {row.answered} correct ({Math.round(row.accuracy * 100)}%)"`. The brief explicitly bans raw scoring + percentages in the parent UI; remediation = drop the literal counts/percentage and keep only the difficulty estimate Badge + a plain-language sentence. Tracked in §7.

---

## 6. Microcopy (baseline)

| Context | Bad | Good |
|---|---|---|
| Entry title | "Baseline Assessment" | "A quick check-in" (already shipped) |
| Entry description | "Complete the baseline diagnostic to populate your mastery map." | "A few friendly questions so your tutor knows where to start." (already shipped) |
| Not-ready | "Prerequisites missing." | "A grown-up will set this up." (already shipped) |
| Question prompt | "Solve: 7 × 3" | "What is 7 × 3?" (the prompt itself comes from the generator; copy rule: question marks + complete sentences) |
| Skip | "Question skipped." | "We'll come back to that one." (planned toast on skip submit) |
| Inline hint | "Solution hint: regroup." | "Hint: try counting up by 3s." (the question's `hint` field carries this) |
| Difficulty badge | "Stretch · diagnostic_tier_3" | "Stretch" (drop the technical tail) |
| Submit affordance | "Send answer" | "Submit answer" (already shipped) |
| Complete title | "Baseline complete." | "Nice work!" (already shipped) |
| Complete body | "Score: 7/10 correct." | "You answered N of M questions." (already shipped — no correctness) |
| Parent headline | "Mastery delta computed across 5 subjects." | "Sky finished their baseline. We'll start in reading with shorter steps." |

---

## 7. Engineering handoff

1. ⬜ **Dedicated "purpose explanation" Card on `/learner/baseline`** — promote the description text to a soft Card with two sentences explaining there's no grade and no score. Pairs with the UX-07 brief screen #2.
2. ⬜ **Visible "Take a break" button on the runner** — overlay Card with calm copy ("Take a breath. We'll wait for you.") + Resume button. Refresh-safe today, but a learner needs the explicit affordance.
3. ⬜ **Learner-safe difficulty Badge** — today the runner shows `difficulty.replaceAll("_", " ")` (e.g. "warm up", "stretch"). Two options: drop the badge entirely on the learner card (least pressure), or keep only the warmest labels ("warm up" / "let's try") and hide higher tiers. Decision deferred to design review.
4. ⬜ **TTS playback** — wire the `<Volume2>` chip to actually play `readAloudText` using the learner's `audioPreferences`. Parallel with UX-06 §8.3.
5. ✅ **Parent-side "Restart baseline"** — already shipped on `/parent/learners/[learnerId]/baseline`: a `Restart` form button (in-progress state) and `Restart baseline` button (complete state) both POST to `startBaselineAction`, which re-uses any in-progress baseline or creates a fresh one if the current is complete. Audit entry written via `audit("baseline.create", …)`. ⬜ Outstanding nit: the action does not soft-delete the prior baseline's attempts before creating a new one — re-runs on a wedged in-progress baseline simply continue the same `Baseline` row rather than starting clean. Decide whether to add a real "reset" semantics (new baseline + prior marked `abandoned`) or keep the current "resume-or-create" behaviour.
6. ⬜ **Mobile Learner Mode + Parent Mode** — owned by UX-12 + UX-13. The current server pages are reusable as-is; the mobile shell needs to handle the `?as=parent` mode and the role-switch back to parent on completion.
7. ⬜ **Generating + processing states** — when `createBaseline` and `completeBaseline` move from synchronous repo calls to async LLM-backed flows, both will need progress Cards on the corresponding pages. Today both are instant.
8. ⬜ **Strip raw scoring from `/parent/learners/[id]/baseline`** — the per-subject grid currently renders `"{correct} of {answered} correct ({pct}%)"`, which the UX-07 brief explicitly bans. Replace with: the existing difficulty-estimate Badge + a plain-language sentence ("Confident in addition", "Needed support with subitizing"), generated from `BaselineSummary.perSubject[].estimate` + a learner-safe label table. Aligns the parent UI with §1 principle 6 and §5.
9. 🟡 **Learner runner description copy** — today the runner shows `For <learnerName>.` whenever the learner record loads. The brief's intent is the lower-pressure "Take your time. You can skip." Promote that to the primary description and demote the learner name to a smaller sub-line (or drop it entirely on the learner runner — it's redundant in learner mode and only meaningful in `?as=parent`).
10. ✅ **Server actions enforce learner-scope twice** — `requirePageRole` + `parentCanAccessLearner` + `assertBaselineMatchesLearner`. Keep this defense-in-depth pattern when adding new mutating server actions (the BFFs guard one side; server actions bypass BFFs, so they need their own guard).
11. ✅ **Audit trail** — `baseline.create`, `baseline.answer` (with isCorrect + skipped), `baseline.complete` (with correct/answered counts) all already wired via `lib/bff/audit.ts`. Keep the same labels when adding new baseline-related events.

---

## Acceptance criteria (per UX-07 brief)

- [x] Learner understands baseline purpose — entry page title "A quick check-in" + description "A few friendly questions so your tutor knows where to start." (§3.1). Dedicated purpose-explanation soft Card is the §6.1 polish item.
- [x] Learner can complete baseline without feeling judged — one question at a time; Skip is first-class; no scores or correctness on the learner UI; "Nice work!" completion (§3.2.1 + §6).
- [🟡] Baseline supports read-aloud and breaks — read-aloud **chip** rendered today, **TTS playback** ⬜ (§7.4). **Break button** ⬜ (§7.2) — refresh is implicitly safe but the explicit affordance is the brief's intent.
- [🟡] Parent can understand results in plain language — `BaselineSummary.parentSummary` headline is shipped and plain-language; **however** the per-subject grid currently shows raw `"X of Y correct (Z%)"` which violates the brief's "no overly technical scoring" rule. Remediation tracked in §7.8.
- [x] Baseline completion leads to mastery map and Today's Mission — `completeBaseline` calls `refreshLearnerReadiness`; readiness flips to `ready_for_today_mission` or `active_learning`; next `pickTodaysMission` call surfaces a `baseline_followup` (`first_skill`) node (§2 + UX-05 §3).

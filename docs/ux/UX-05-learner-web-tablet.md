> Status: **draft for review** · Sprint UX-05 · scope = `apps/web-v2/app/learner/**` (web + tablet) · **Last refreshed**: 2026-05-17 (verified current — 19 learner routes unchanged; `pickTodaysMission` 4-branch priority unchanged; `startMissionAction` consent + rate-limit + audit chain unchanged).

# Sprint UX-05 — Learner Web and Tablet UX

**Scope**: every learner-facing surface on web + tablet (`apps/web-v2/app/learner/**` — 19 routes today). The Lesson Player itself is the focus of UX-06 (this doc owns the *shell around it*: home, missions, baseline status, subjects, quests, homework, progress, settings, profile select). Mobile Learner Mode is covered by UX-12 + UX-13.

**Source of truth (today)**:
- Routes: `app/learner/**` (19 `page.tsx` files — see §2 sitemap).
- Today's Mission picker: `lib/learner/today.ts` (`pickTodaysMission` — 4-branch priority today: resume → teacher-assigned → path-driven → cleared-path fallback; quest + parent-assigned stubs reserved for later sprints; see §3 for exact ordering and `learnerSafeReason` non-clinical copy).
- Home-page action: `startMissionAction` in `app/learner/home/page.tsx` — already wires consent (`child_data_collection` + `ai_personalization`), rate-limit (`RATE_LIMITS.AI_GENERATION`), `createLessonRun`, audit, and redirect to `/learner/lesson-runs/[id]`.
- Components: `mission-card.tsx`, `lesson-step-card.tsx`, `learner-avatar.tsx`, `subject-icon.tsx`, `tutor-badge.tsx`, `accessibility-form.tsx` + shared `components/ui/*`.
- Mental model: learner app is **one big "what should I do now?"** — the Stage is the destination, every other learner surface is a brief excursion off it.

Status legend: ✅ shipped · 🟡 partial · ⬜ planned.

---

## 1. Principles

1. **One primary action per screen.** Home has one CTA (Start / Continue today's mission). Subject detail has one (Start a lesson in this subject). Quest chapter has one (Open next chapter step). No competing primaries.
2. **Today's Mission is the dominant element.** On `/learner/home` it occupies the top of the page at a size that makes it the visual anchor — even on a 13" laptop the CTA is at least 56px tall.
3. **Tablet-first geometry.** Touch targets ≥ 44×44px (WCAG 2.5.5 minimum) and learner-mode density tokens add 8px to all interactive padding compared to parent/teacher. Cards use `--aivo-density-card-pad` from the learner theme (already in `globals.css`).
4. **No dashboard-first.** No grid of stat cards on home. Progress is one tap away (`/learner/progress`) but is never the landing experience.
5. **Supportive correction, not shame.** "Wrong" is never the word. `learnerSafeReason()` already enforces this on the mission card; the Stage extends the pattern with "Let's look again", "One more step", "Try a smaller piece".
6. **No diagnostic labels.** No "dyslexia", "ADHD", "PRE_SYMBOLIC", "Tier 2". Tutor name + tone + style is the only personalization label that's surfaced.
7. **Resume must feel seamless.** If a `LessonRun` is in progress, the home CTA changes to `Continue` and routes straight to `/learner/lesson-runs/[runId]` — no intermediate screen. Already wired via `existingRunId` in `pickTodaysMission`.
8. **Accessibility is part of the visual design, not a setting page.** Read-aloud, captions, and reduced motion are toggleable from a learner-mode "comfort" affordance reachable from any learner screen (top-right of AppShell). The full `/learner/settings/accessibility` page exists for deeper tweaks.

---

## 2. Learner sitemap (web + tablet — 19 routes)

```
/learner
├── /select                                        ✅ profile chooser (parent helping mode)
├── /home                                          ✅ Today's Mission + secondary tiles
├── /missions                                      ✅ list of recent / upcoming missions
├── /baseline                                      ✅ baseline entry (status + start)
│   └── /[baselineId]                              ✅ baseline run (player — UX-07)
├── /lesson-runs/[lessonRunId]                     ✅ Stage / Lesson Player — owned by UX-06
├── /subjects                                      ✅ subject tiles
│   └── /[subjectId]                               ✅ subject detail (skills + path)
├── /quests                                        ✅ Quest worlds grid
│   └── /[worldId]
│       └── /chapters/[chapterId]                  ✅ chapter detail → start chapter lesson
├── /homework                                      ✅ homework helper entry / sessions
│   └── /[sessionId]                               ✅ homework helper chat session
├── /library                                       ✅ saved / reread items
├── /progress                                      ✅ simple visual progress
├── /rewards                                       ✅ XP, badges, currency (engagement)
├── /notifications                                 ✅ messages from tutor / parent / teacher
└── /settings
    ├── /accessibility                             ✅ text size, motion, captions, contrast
    └── /audio                                     ✅ TTS voice / rate / read-aloud defaults
```

`LEARNER_NAV` order today (from `components/layout/role-shells.tsx`): **Today · Progress · Missions · Library · Rewards · Settings** (Settings link points to `/settings/accessibility`). Subjects, Quests, and Homework are reachable but **not in the primary nav today** — they live as routes only. Adding them to `LEARNER_NAV` (Subjects + Quests + Homework) is a ⬜ planned change tracked in §8.8 to align the nav with the home-page mental model.

---

## 3. Today's Mission picker (canonical)

Already shipped in `lib/learner/today.ts` as `pickTodaysMission(learnerId, tenantId): TodayMissionResult`. The picker returns **exactly one** mission or one of three blockers. Every learner home surface uses this same output.

**Priority order** (exact, matches `lib/learner/today.ts` today):

1. **Resume in-progress LessonRun** — first `LessonRun` with status `in_progress` or `ready` → `kind: "resume_in_progress"`. `existingRunId` set.
2. **Teacher-assigned work** — `listActiveAssignmentsForLearner()`; first uncompleted assignment with at least one skill → `kind: "subject_path"`, `source: "teacher_assigned"`. Deliberately hoisted **above the no-baseline check** so a teacher can assign work to a learner who hasn't finished baseline yet.
3. **Path-driven pick** — requires a baseline (`MasteryMap` exists) and a LearningPath with nodes. Path nodes are sorted by an internal `KIND_PRIORITY`: `first_skill (1) → review (2) → next_unmastered (3) → stretch (4)`, then by `order`. The first node whose `sourceRefId` (path node id) hasn't been completed wins. Non-review nodes are also filtered out if their `skillId` was completed via any other LessonRun (so an ad-hoc / quest run doesn't re-feed the same first_skill / next_unmastered node).
   - `kind: "first_skill"` → `kind: "baseline_followup"`, `source: "baseline_followup"`.
   - `kind: "review"` → `kind: "review"`, `source: "subject_path"`.
   - `kind: "next_unmastered"` → `kind: "next_unmastered"`, `source: "subject_path"`.
   - `kind: "stretch"` → `kind: "subject_path"`, `source: "subject_path"`.
4. **Cleared-path fallback** — when every path node is done, the last node is replayed as a stretch (`kind: "subject_path"`, learner-safe copy "You finished the path! One more pass for fun.").
5. Quest follow-up + parent-assigned are **not wired today** (commented stubs in `today.ts` for Sprints 16 + 14); they're not in `TodayMissionPlan.kind` yet.

**Blockers** (the only three returned today):
- `no_learner` — defensive; never expected at home (`requirePageRole` guards above).
- `no_baseline` — `MasteryMap` missing. Home shows a "Finish the baseline first" amber card.
- `no_path` — `MasteryMap` exists but `LearningPath` has zero nodes. Home shows "Your learning path isn't ready yet" amber card.

`startMissionAction` (the server action on `/learner/home`) layers two **additional** redirect-only blockers on top of the picker's output — these are URL query params, not picker outputs:
- `?blocker=consent` — missing `child_data_collection` or `ai_personalization`.
- `?blocker=rate_limit` — `RATE_LIMITS.AI_GENERATION` bucket exhausted.
- `?blocker=generation` — `createLessonRun` returned `ok:false`.

**`TodayMissionPlan` kinds shipped today**: `resume_in_progress · baseline_followup · next_unmastered · review · subject_path`. Note that **teacher-assigned work currently surfaces under `kind: "subject_path"`** with `source: "teacher_assigned"` (not a dedicated `teacher_assigned` kind). Adding distinct `quest_followup` / `parent_assigned` / `teacher_assigned` kinds is ⬜ planned when those upstream features ship.

**Output fields used by the UI** (real fields from `TodayMissionPlan`):
- `kind` — picker tag for analytics + per-kind copy variations.
- `source` — written through to `LessonRun.source` when the run is created.
- `subjectName` + `skillName` — what the learner is doing (`Badge` + `<h3>` on the home card).
- `estimatedMinutes` — surfaced as a neutral `Badge`.
- `reason` — parent-readable (used in `/parent/learners/[id]/summary`).
- `learnerReason` — learner-safe one-liner (used as the page description and the card body; comes from `learnerSafeReason()` for path picks and from hand-written non-clinical copy for the resume / teacher-assigned / cleared-path branches).
- `existingRunId` — when set, the home form CTA label is `"Resume lesson"`; otherwise `"Start today's lesson"`.

---

## 4. Screen-by-screen spec

### 4.1 `/learner/select` (profile chooser)

- **Purpose**: when a parent navigates to `/learner/*` without an active-learner cookie set, pick which learner to "hand the device to".
- **Primary CTA**: per-card `<LearnerAvatar size="lg">` + name button → sets `active-learner` cookie → `/learner/home`.
- **States**: empty (only one learner — auto-pick + redirect); error (no learners — should never reach this state from `/parent/home`; defensive `<EmptyState>` with link back).
- **A11y**: each card is a `<button>` (not a Link styled as a card) so focus + Enter activate; large avatar; learner name in display-font 24px.

### 4.2 `/learner/home` (today's implementation + this sprint's deltas)

- **Purpose**: answer "What should I do now?" in one glance.
- **Today's structure** (literal — read `app/learner/home/page.tsx`):
  1. `<PageHeader>` — eyebrow `"Today"`, title `"Hi, <FirstName>!"`, description = `today.mission.learnerReason` (or the setup-prompt fallback). For parents in helping mode, an actions slot shows `Switch learner` → `/learner/select`.
  2. **Parent-in-helping-mode banner** (amber Card): `"You're viewing the learner experience for <name>."` Renders only when `session.role === "parent"`.
  3. **Tutor card**: `<LearnerAvatar size="lg">` + `"Your tutor today"` + tutor style sentence + `<TutorBadge name="Nimbus" persona={style}>`.
  4. **Mission card**: section `<SectionHeader title="Today's mission">` then a `<Card>` with two `<Badge>`s (subject + `≈ N min`), `<h3>` skill name, the `learnerReason` paragraph, and a `<form action={startMissionAction}>` with a hidden `learnerId` input + the `<Button size="lg">` whose label is `"Resume lesson"` or `"Start today's lesson"` per `existingRunId`. **This is a hand-composed `<Card>`, not the `<MissionCard>` primitive.**
  5. **Single secondary tile**: section `<SectionHeader title="See your progress">` then a `<Card>` → `View progress` → `/learner/progress`.
- **Server action**: `startMissionAction` — re-authorizes on the server (parent cookie OR session `learnerId`), checks `child_data_collection + ai_personalization` via `hasLearnerConsent`, enforces `RATE_LIMITS.AI_GENERATION` via `tryConsumeRateLimit`, picks the mission via `pickTodaysMission`, then either redirects to the `existingRunId` *(no `createLessonRun` call, no audit emit on this branch)* or creates a new `LessonRun` via `createLessonRun()`, emits `audit(session, "today.start", "page-action", {…})`, and redirects to `/learner/lesson-runs/[id]`. **Audit is emitted only on the new-run branch** (DD-12 backlog: emit on the resume branch too, with `kind: "resume_in_progress"`).
- **Blocker UI (when `today.ready === false`)** — amber Card whose copy is computed from `params.blocker ?? today.blocker`:
  - `no_baseline` → "Finish the baseline first."
  - `no_path` → "Your learning path isn't ready yet."
  - `generation` → "We had trouble preparing the lesson. Try again."
  - **catch-all** (covers `consent`, `rate_limit`, `no_learner`, undefined): "Setup is almost done." Parents also see a `<Button variant="soft">` → `/parent/learners/[id]` for `Open setup`.
- **Gaps vs the UX-05 brief** — all of these are ⬜ this sprint's deliverables for engineering:
  - The home page renders a hand-composed `<Card>`, not `<MissionCard>`. Migrating to `<MissionCard>` (which already accepts `subject`, `title`, `description`, `href`, `progress?`, `estMinutes?`) is the recommended refactor — the primitive already handles the SubjectIcon + Progress + estMinutes layout the brief calls for. ⬜
  - `<SubjectIcon>` is **not** on the home card today (only Badges + h3). Add it via the `<MissionCard>` migration. ⬜
  - `<Progress>` for in-flight runs is **not** wired today — when `existingRunId` is set, no progress bar shows. The MissionCard primitive accepts `progress?: number`; computing it from `LessonRun.completedStepIds.length / LessonRun.totalSteps` is the wiring task. ⬜
  - Per-blocker copy differentiation — today `consent` / `rate_limit` / `no_learner` all collapse into "Setup is almost done." Splitting them into distinct learner-safe copy (consent → "Ask a grown-up to finish setting up AIVO"; rate_limit → "Big breath — let's start in a moment" with countdown; generation already has dedicated copy) is the §8.5 work. ⬜
  - Subjects / Quests / Homework Helper tiles on home — **not present today**; the only secondary tile is Progress. Adding the three additional tiles (so the home matches the UX-05 brief "secondary links to Subjects, Quests, Homework Helper, Progress") is ⬜ planned alongside the §2 nav change.
- **A11y**:
  - ✅ The `<PageHeader>` h1 (`Hi, <name>!`) is the first heading; each section uses `<SectionHeader>` h2; the mission card title is h3.
  - ✅ The CTA is a real `<button type="submit">` inside a `<form>` — keyboard-reachable, default form-submit semantics.
  - 🟡 The mission card is a plain `<Card>` today — promote it to `role="region" aria-labelledby` once it's the `<MissionCard>` primitive (the primitive can carry the role) so the live-progress update is announced.
- **Mobile / tablet**: single column today (no two-column home layout); responsive to the tutor card's `sm:flex-row sm:items-center` only. The two-column desktop variant described in §7 is ⬜ planned.

### 4.3 `/learner/missions`

- **Purpose**: recent + upcoming missions (last 7 days + next picked). Read-only list.
- **Primary CTA**: tap a future / current mission → re-runs `pickTodaysMission` for that target and routes to the run (or starts a new one).
- **Empty**: pre-baseline — same "Start your baseline" card as on home.
- **A11y**: list semantics; each row has a Start/Continue button — not the whole row is clickable (avoids accidental taps on tablet).

### 4.4 `/learner/baseline` + `/baseline/[baselineId]`

- **Purpose**: entry to the baseline assessment. UX-07 owns the in-run experience; this doc covers the entry card.
- **Primary CTA**: "Start" if `not_started`; "Continue" if `in_progress`; "See result" if `completed` → routes to a learner-friendly summary card (no scores; one sentence).
- **States**: standard run-status card pattern as `/parent/learners/[id]/baseline` from UX-04 §4.8 — single source of truth on baseline status.

### 4.5 `/learner/lesson-runs/[lessonRunId]` (Stage)

Owned by **UX-06** (Lesson Player). This doc only notes: the entry contract is "an existing `LessonRun.id` always exists at this URL"; if not, redirect to `/learner/home`. No `LessonRun` is ever auto-created on this page — they're created upstream by `startMissionAction` or a similar entry. (Already enforced — see `app/learner/lesson-runs/[lessonRunId]/page.tsx`.)

### 4.6 `/learner/subjects` + `/[subjectId]`

- **Purpose**: browse subjects + see the path inside one.
- `/subjects`: tile grid using `<SubjectIcon size="lg">` + subject name + a single-line "where you are" line (e.g. "On step 4 of 12").
- `/subjects/[id]`: shows the LearningPath for that subject as a `<Stepper>` (path nodes) with each node showing skill name + mastery badge + a Start/Continue button. Currently in-progress node is highlighted; future nodes are dim but discoverable.
- **Primary CTA on subject detail**: the current path node's Start/Continue button. Same `createLessonRun` pattern as home, just scoped to that node's skill.
- **A11y**: stepper has `aria-label="<Subject> learning path"`; each node is a list item with state (`aria-current="step"` for the active node).

### 4.7 `/learner/quests` + `/[worldId]/chapters/[chapterId]`

- **Purpose**: gamified narrative wrapper around skill practice — UX-09 owns the full quest model; this doc covers the navigation shell.
- `/quests`: worlds grid. Each world card shows unlocked / locked state. Locked worlds show a learner-safe "Finish 2 more chapters in <PreviousWorld> to unlock" (no XP-as-token-economy language).
- `/quests/[worldId]/chapters/[chapterId]`: chapter detail. Hero illustration + chapter name + a single "Start this chapter" CTA that creates a `LessonRun` with `source: "quest"`.
- **Critical rule**: quest progress is **never fake**. A chapter only advances when the underlying `LessonRun.status === "completed"`. (DD-07 from UX-00 audit.)

### 4.8 `/learner/homework` + `/[sessionId]` (Homework Helper)

- **Purpose**: open-ended homework support — a chat surface with the learner's primary tutor.
- `/learner/homework`: list of sessions + a "Start a new homework session" CTA.
- `/learner/homework/[sessionId]`: chat UI. Each message has tutor identity, learner-safe phrasing, and per-message rate-limit (already wired via `RATE_LIMITS` on `POST /api/bff/learners/[id]/homework/[sessionId]/message`).
- **States**: empty (no messages yet) shows a prompt suggestion list; error per-message with retry; rate-limit → "Big breath — let's try in a moment" identical to home.
- **A11y**: messages render with `aria-live="polite"` for incoming tutor messages.

### 4.9 `/learner/library`

Saved / reread items the learner can return to. Card grid. Empty: "Anything you save will live here."

### 4.10 `/learner/progress`

- **Purpose**: simple, encouraging progress view for the learner — **never** a stats dashboard.
- **Layout**: per-subject Card with an oversized `<Progress>` bar + a one-line "What you grew in" sentence (latest mastered skill). No percentages where avoidable; if shown, framed as "X out of Y skills". No charts.
- **Copy rule**: never the word "behind". Always forward-looking ("Next up: …").
- **Empty**: "Your progress will show up once you finish your first lesson."

### 4.11 `/learner/rewards`

XP / badges / currency. Owned conceptually by the engagement system (UX-09 + UX-08). Critical rules from UX-00 audit: rewards are tied to *real* completed lessons; no fake currency drops; no "you have 14 minutes of XP left before reset" language.

### 4.12 `/learner/notifications`

Messages from the tutor / parent / teacher. Filter chips: All · From your tutor · From your grown-up · From your teacher. Each item has one Open action. No marketing notifications surface here ever.

### 4.13 `/learner/settings/accessibility` + `/audio`

The full settings surface (the comfort affordance in the AppShell header is the quick version). Toggles + radios — every change writes to `learnerAccessibilityProfile` + `audioPreferences` via the corresponding BFFs. Save is per-field (no Save button — autosaves with a small "Saved" indicator + Toast on failure).

---

## 5. State matrix (learner app)

| Surface | Loading | Empty | Error | Retry | Notes |
|---|---|---|---|---|---|
| `/learner/select` | n/a (server render) | "Ask a grown-up to add a learner" | n/a | n/a | only reachable when parent navigates to `/learner/*` without active cookie |
| `/learner/home` | ⬜ skeleton (big card + 4 tiles) | per-blocker cards (no_baseline · no_path · consent · rate_limit · generation) | shell error boundary | tap the same CTA | ✅ blockers wired in `startMissionAction` |
| `/learner/missions` | ⬜ skeleton rows | "Start your baseline" | inline | retry | |
| `/learner/baseline(+/[id])` | run player handles | "Start" CTA | per-question retry | retry | UX-07 owns in-run |
| `/learner/lesson-runs/[id]` | ⬜ Stage entry skeleton | n/a (always existing run) | UX-06 | UX-06 | owned by UX-06 |
| `/learner/subjects` | ⬜ tile skeleton | "Subjects unlock after your baseline" | inline | retry | |
| `/learner/subjects/[id]` | ⬜ Stepper skeleton | n/a (subject always exists) | inline | retry | |
| `/learner/quests` | ⬜ world tile skeleton | "Quests unlock after your first lesson" | inline | retry | |
| `/learner/quests/[w]/chapters/[c]` | ⬜ hero skeleton | n/a | inline | retry | progress is never fake (DD-07) |
| `/learner/homework` | ⬜ list skeleton | "Start a new homework session" | inline | retry | |
| `/learner/homework/[id]` | typing indicator | prompt-suggestion list | per-message retry; rate-limit card | retry / wait | `aria-live="polite"` on tutor messages |
| `/learner/library` | ⬜ skeleton | "Anything you save will live here." | inline | retry | |
| `/learner/progress` | ⬜ skeleton | "After your first lesson" | inline | retry | no charts |
| `/learner/rewards` | ⬜ skeleton | "Earn your first reward in a lesson" | inline | retry | tied to real completions |
| `/learner/notifications` | ⬜ skeleton | "Nothing new." | inline | reload | |
| `/learner/settings/accessibility(+/audio)` | per-field "Saving…" | n/a | per-field error toast | resave | autosave; no Save button |

---

## 6. Copy patterns (learner)

| Context | Bad | Good |
|---|---|---|
| Daily greeting | "Welcome back, user." | "Hi <FirstName>. Ready for today's step?" |
| Mission reason | "Skill: addition_within_20, mastery=0.18" | "Today's a Math step. Let's grow this one together." (`learnerSafeReason()` already produces this) |
| Wrong answer | "Wrong." / "Incorrect." | "Let's look again." / "One more step — you've got this." |
| Lesson done | "Lesson complete. +12 XP." | "You did it! Take a breath. You'll see what's next on your home screen." |
| Locked quest world | "World 3 locked. Earn 200 XP to unlock." | "Finish 2 more chapters in <PreviousWorld> to open this one." |
| Rate-limit hit | "Rate limit exceeded (429)." | "Big breath — let's start in a moment." |
| Consent missing | "Required consent `child_data_collection` is not on file." | "Ask a grown-up to finish setting up AIVO." |
| Generation failure | "AI generation failed." | "Hmm — we couldn't get today's lesson ready. Tap to try again." |

---

## 7. Tablet vs desktop vs mobile-web

| Breakpoint | Treatment |
|---|---|
| **Tablet (768–1280, primary target)** | Single column. Mission card spans full content width minus 32px gutter. Secondary tiles wrap 2×2 below. Touch targets ≥ 44×44. AppShell sidebar collapses to a header strip with hamburger; primary nav is bottom-anchored (mirrors mobile-web). |
| **Desktop (≥ 1280)** | Two-column on home: mission card 2/3 + secondary tiles in a vertical rail 1/3. Subjects + Quests + Progress remain card grids. Sidebar shows full `LEARNER_NAV`. |
| **Mobile web (≤ 480)** | Single column; mission card stretches; secondary tiles wrap 2×2 below; AppShell is bottom-tab pattern (matches the unified mobile app). For consistency, the same layout is reachable on bigger phones in landscape. |

---

## 8. Engineering handoff

1. ✅ `startMissionAction` is the canonical entry pattern (server action + consent guard + rate limit + pick + audit + createLessonRun + redirect). Reuse the shape for any new "start something" CTA (quest chapter start, homework session start).
2. ⬜ **Skeleton boundaries** on every learner surface — `Skeleton` primitive exists; wire Suspense boundaries. Today server-rendered + instant for in-memory store; will matter against a real backing service. (Same DD-09 as UX-04 §8.2.)
3. ⬜ **Comfort affordance in AppShell header** — quick toggles for text size + read-aloud + reduced motion, reachable from any learner screen. Today only via `/learner/settings/accessibility`.
4. ⬜ **Migrate the home card to the `<MissionCard>` primitive** — the primitive already accepts the inputs the UX-05 brief calls for (`subject`, `title`, `description`, `href`, `progress?`, `estMinutes?`). The migration also brings `<SubjectIcon>` onto the card (today only Badges + h3).
5. ⬜ **`<Progress>` for resuming runs** — when `existingRunId` is set, compute progress from `completedStepIds.length / totalSteps` on the in-flight `LessonRun` and pass to MissionCard. Today the home page does not compute it.
6. ⬜ **Per-blocker copy differentiation on home** — today `consent`, `rate_limit`, `no_learner`, and undefined all collapse into "Setup is almost done." Split them per §4.2 and §6 copy table; add a rate-limit countdown timer reading the bucket refill timestamp.
7. ⬜ **Resume-run audit emit** — `startMissionAction` only emits `audit("today.start", …)` on the new-run branch; emit on the existing-run branch too with `kind: "resume_in_progress"` so the analytics + audit trails are symmetric.
8. ⬜ **`LEARNER_NAV` redesign** — add Subjects, Quests, Homework to the primary nav (current nav: Today · Progress · Missions · Library · Rewards · Settings). The UX-05 brief calls for these as primary navigation entries; pairs with adding the three corresponding secondary tiles on `/learner/home` per §4.2.
9. ⬜ **Learner-safe profile select** — when a parent uses `Hand the device to <learner>`, the flicker to `/learner/select` is jarring if there's only one learner. Auto-pick + skip the select page when learner-count = 1.
10. ⬜ **Add distinct picker kinds** for quest / parent-assigned / teacher-assigned in `TodayMissionPlan` once those features ship — today teacher-assigned work surfaces as `kind: "subject_path"` + `source: "teacher_assigned"`, which is fine for the run record but blurs the analytics signal.

---

## Acceptance criteria (per UX-05 brief)

- [x] Learner home clearly answers "What should I do now?" — the mission Card is the dominant element below the tutor card; `learnerReason` is the answer (§3 + §4.2). Brief sub-bullets all map to real data: Tutor (via `<TutorBadge>`), Subject (Badge), Goal (`skillName` h3), Estimated time (Badge), Why this matters (`learnerReason`), Start/Continue CTA (`Resume lesson` / `Start today's lesson`).
- [x] Learner can start or resume Today's Mission — `startMissionAction` handles both paths (§4.2); `existingRunId` flips the button label.
- [🟡] Learner can access subjects, quests, homework, and progress — **today only Progress is on home + nav**; Subjects, Quests, Homework are reachable as routes but **not in `LEARNER_NAV` and not as secondary tiles on `/learner/home`**. Adding the three nav entries + three home tiles is the §8.8 + §4.2 backlog item this sprint produces.
- [x] Learner screens are not dashboard-first — Principle 4; home is one tutor card + one mission card + one Progress tile; no stats grid on the landing.
- [🟡] Learner UI is accessible, low-clutter, and supportive — touch targets, semantics, non-clinical copy all called out across §1, §4, §6. **Pending**: skeleton boundaries (§8.2), the AppShell comfort affordance (§8.3), the MissionCard migration + live-progress wiring (§8.4 + §8.5), and the per-blocker copy split (§8.6) — listed in §8 as the ⬜ work this sprint produces for engineering.
- [🟡] Every learner surface has loading / empty / error / retry states — empty + error are uniformly covered today (§5); **loading skeletons** are listed ⬜ across §5 and §8.2.

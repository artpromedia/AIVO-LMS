# Mobile → Web Parity Sprint Plan

**Owner:** Mobile platform team · **Created:** 2026-05-31 · **Status:** Proposed

Goal: bring the Expo mobile app (`apps/mobile/`) to feature parity with the
Next.js web app (`apps/web-v2/`) across the five roles that ship on mobile —
**learner, parent, teacher, therapist, caregiver**. School / district / internal
admin surfaces stay web-only and are out of scope (see `docs/NAVIGATION.md`).

This plan is driven by the automated parity test:

```bash
pnpm mobile:parity         # summary table + drift guard
pnpm mobile:parity:strict  # fails CI on any untracked web route
pnpm mobile:parity:md      # regenerate docs/mobile-parity.md
```

## Where we stand (parity test baseline)

| Status              | Count   |
| ------------------- | ------- |
| Parity              | 34      |
| Partial             | 15      |
| Missing             | 64      |
| **In-scope routes** | **113** |

**Full parity today: 30%.** 79 routes need work (15 partial + 64 missing).
90 web-only routes (admin / dev / design-system) are excluded by design.

Gap concentration by role:

| Role       | Parity | Partial | Missing | Headline gap                                                                     |
| ---------- | :----: | :-----: | :-----: | -------------------------------------------------------------------------------- |
| Parent     |   8    |    2    |   31    | Entire learner-management hub (profile, assessment, gradebook, reports, privacy) |
| Learner    |   7    |    5    |   14    | Subjects, baseline runner, progress, library, missions, notifications            |
| Onboarding |   3    |    3    |   11    | Full onboarding flow (welcome→role→verify→child-approval)                        |
| Teacher    |   3    |    4    |    6    | Classes, assignments, roster list, lesson-plan library                           |
| Caregiver  |   3    |    0    |    1    | Learners list only — effectively at parity                                       |
| Therapist  |   3    |    1    |    0    | Cross-client reports roll-up only — effectively at parity                        |

The full route-by-route matrix lives in [`docs/mobile-parity.md`](../mobile-parity.md)
(generated). Every gap below carries a `MOB-*` ticket ID from that matrix.

## Planning assumptions

- **Cadence:** 2-week sprints, one squad of 3–4 mobile engineers + 1 designer +
  shared QA. Estimates are squad-sprints, not person-days.
- **Backend is ready.** Web already consumes these endpoints; mobile reuses the
  same services (identity, learning, engagement, brain, assessment, family,
  comms, billing). No new services required — only new mobile data hooks.
- **Reuse-first.** Screens follow the established mobile pattern: a React Query
  hook in `apps/mobile/hooks/`, composed from `@aivo/mobile-ui` primitives,
  themed via `useSensoryPalette()` / `useTierTheme()`, responsive via
  `useWindowSizeClass()`. Contract types are shared from `apps/mobile/src/contracts/`.
- **Definition of Done (every screen):** data hook + screen + i18n keys (10
  locales) + sensory/calm + reduced-motion + tablet layout + Vitest + an
  entry in the parity matrix flipped to `Parity`, with `pnpm mobile:parity`
  green.
- **No parity drift.** `pnpm mobile:parity:strict` runs in CI so any new web
  route forces a matrix update.

## Epics

| Epic | Theme                                                                   | Tickets                                   | Sprints |
| ---- | ----------------------------------------------------------------------- | ----------------------------------------- | ------- |
| E0   | Foundations: nav areas, data hooks, mobile charts, notifications stream | infra                                     | S1      |
| E1   | Onboarding & auth parity + accessibility infra                          | MOB-ONB-\*, MOB-A11Y-001, MOB-LRN-013/014 | S2      |
| E2   | Learner academic core                                                   | MOB-LRN-002…012, 015                      | S3–S4   |
| E3   | Parent learner-management hub                                           | MOB-PAR-001…017                           | S5–S7   |
| E4   | Parent account & compliance                                             | MOB-PAR-018…023                           | S8      |
| E5   | Teacher classroom tools                                                 | MOB-TCH-001…010                           | S9–S10  |
| E6   | Therapist / caregiver close-out + partial cleanup                       | MOB-THR-001, MOB-CGV-001                  | S11     |
| E7   | Offline, unified-shell cutover, hardening & launch                      | infra                                     | S12     |

---

## Phase 0 — Foundations

### Sprint 1 — Navigation areas, shared data hooks, mobile chart kit

**Goal:** stand up the plumbing every later screen needs, so feature sprints
are pure screen work.

Scope:

- **Nav areas on mobile.** Wire the canonical areas that mobile is missing into
  the role shells per `docs/NAVIGATION.md` route map: learner `subjects`,
  `lessons`, `progress`, `baseline`, `messages`; parent `learners`, `reports`,
  `lessons`, `subjects`; teacher `learners`, `classes`, `assignments`. Routes
  registered now, screens land in later sprints behind a `comingSoon` guard
  that the parity script does **not** count as parity.
- **Data hooks** (`apps/mobile/hooks/`), each mirroring the web BFF call:
  `useSubjects` / `useSubject`, `useProgress`, `useLessonRuns` / `useLessonRun`,
  `useLibrary`, `useMissions`, `useNotifications`, `useReports`, `useSchedule`,
  `useConsent`, `usePrivacy`, `useGradebook`. Shared contract types added to
  `apps/mobile/src/contracts/`.
- **Mobile chart kit** in `@aivo/mobile-ui` mirroring `@aivo/ui` chart
  components used by web progress/gradebook: `MasteryBar`, `TrendChart`
  (lessons-by-day), `MasteryHeatStrip`, `DotChart`, `ConfidenceMeter`. Built on
  `react-native-svg`, reduced-motion aware.
- **Notifications stream client** — SSE-with-polling-fallback wrapper
  (`apps/mobile/lib/notifications-stream.ts`) reusable by learner + parent
  notification screens.

Acceptance: new hooks have Vitest coverage against fixture payloads; chart kit
renders in Storybook/`(shell-demo)`; `pnpm mobile:parity` count unchanged (no
false parity); type-check + lint green on web and mobile.

Risk: chart kit fidelity vs web. Mitigation: snapshot-test against the same
fixture data web uses.

---

## Phase 1 — Onboarding & Accessibility (unblocks new-user activation)

### Sprint 2 — Onboarding flow + accessibility settings

**Goal:** a net-new user can fully onboard on mobile, and accessibility is a
first-class settings surface.

Scope (tickets):

- MOB-ONB-001/002/003 — onboarding entry, welcome, role selector.
- MOB-ONB-005/006 — terms, privacy (CCPA/GDPR summary).
- MOB-ONB-008 — device permission priming (camera/mic/notifications via existing
  Expo modules).
- MOB-ONB-010 — parent email/SMS verification.
- MOB-ONB-011 — IEP PDF upload + extraction (`expo-document-picker`, reuse the
  upload contract; learning/assessment service does extraction).
- MOB-ONB-012 — child-approval (parent activates child profile).
- MOB-ONB-013 — learner self-signup; MOB-ONB-014 — onboarding error fallback.
- MOB-ONB-004/007/009 — upgrade existing `(auth)/signup`, `(auth)/consent-sheet`,
  `(parent)/onboard` to web parity (invite codes, full consent checkboxes,
  assessment-intro hand-off).
- MOB-A11Y-001 — global accessibility settings screen; MOB-LRN-013/014 — learner
  accessibility + audio sub-screens. Built on the existing `SensoryModeProvider`
  and assessment-svc per-learner prefs.

Acceptance: an E2E flow (`signup → role → verify → child-approval → first
session`) passes on iOS + Android simulators; accessibility prefs persist and
round-trip to backend; 13 onboarding/accessibility tickets flip to Parity.

Risk: COPPA/consent copy must match web verbatim — pull strings from the same
i18n source, do not re-author.

---

## Phase 2 — Learner academic core

### Sprint 3 — Subjects, Progress, Library, Missions, Notifications

**Goal:** the day-to-day learner academic surfaces reach parity.

Scope (tickets):

- MOB-LRN-002/003 — subjects grid (mastery + baseline gating) and subject detail
  (tutor hero, next-up, recommended skill path, mastery grid). Uses `useSubjects`
  - chart kit.
- MOB-LRN-010 — progress screen (overall mastery %, mastered/needs-support
  counts, lessons-by-day trend, subject heatstrips, recent activity). Uses
  `useProgress` + full chart kit.
- MOB-LRN-006 — completed-lessons replay library (`useLibrary`).
- MOB-LRN-008 — missions (active assignments + in-progress lessons).
- MOB-LRN-012 — learner notifications (stream client from S1).
- MOB-LRN-011 — rewards parity: consolidate mobile badges/shop to mirror web
  `/learner/rewards` (quest-world + sticker-book progress).

Acceptance: 6 learner tickets to Parity; progress charts visually match web
fixtures; subjects respects baseline gating + IEP status.

### Sprint 4 — Baseline assessment + lesson-run host

**Goal:** the highest-complexity learner flow — adaptive baseline — works on
mobile, and lesson runs are robust.

Scope (tickets):

- MOB-LRN-004 — baseline pre-flight set: hub, intro, why, readiness (4-check),
  subject multi-select. Calm, low-stimulation screens.
- MOB-LRN-005 — **adaptive baseline runner**: IRT/streaming session support,
  progress dots, break cadence, supports display (read-aloud, extended time),
  completion hero. Reuses `MobileStageRuntime` patterns where possible; new
  `useBaselineSession` hook over assessment-svc.
- MOB-LRN-007 — lesson-run host states (generating / failed / ready) wrapping the
  existing `(learner)/stage/[sessionId]` runtime; lessons-list entry point.
- MOB-LRN-009 — chapter-level quest navigation parity.
- MOB-LRN-015 — learner brain-clone view (clone build + XAI annotations) parity.

Acceptance: a learner can complete a full baseline offline-tolerant on a phone;
generating/failed lesson states render; 5 learner tickets to Parity. **Learner
role reaches ~100% parity.**

Risk: streaming/IRT session state is the single trickiest flow. Mitigation:
spike `useBaselineSession` in S1 slack; pair with the assessment-svc owner.

---

## Phase 3 — Parent learner-management hub (largest epic)

### Sprint 5 — Learners list, profile hub, per-learner settings

Scope (tickets): MOB-PAR-001 (learners list area), MOB-PAR-002 (add-learner
form with district lookup + AI strength suggestions), MOB-PAR-003 (profile hub:
quick-access + exploration grid + profile basics), MOB-PAR-014 (per-learner
settings + delete), MOB-PAR-017 (per-learner accessibility/audio),
MOB-PAR-013 (sensory profile — 5 modality cards), MOB-PAR-015 (weekly snapshot),
MOB-PAR-016 (overall summary).

Acceptance: parent can manage the roster and drill into a learner; 8 tickets to
Parity.

### Sprint 6 — Parent assessment wizard + baseline + brain-clone approval

**Goal:** close the two most user-visible parent gaps, including the
brain-clone approval that currently forces mobile-only parents to the web.

Scope (tickets):

- MOB-PAR-004 — parent assessment wizard: 17+ steps, per-section autosave, AI
  suggestions on open fields, reassurance sidebars, progress indicator, plus
  intro/review/submitted. A `useAssessmentDraft` hook handles autosave +
  resume.
- MOB-PAR-005 — parent baseline (status, pending, summary).
- MOB-PAR-006 — **brain-clone-watch**: 7-stage cinematic build with XAI
  annotations and approve/amend flow. Closes the long-standing gap where a
  mobile-only parent cannot approve the initial clone.
- MOB-PAR-007 — curriculum upload (CurriculumManager parity).

Acceptance: parent can complete assessment and approve a brain clone entirely on
mobile; autosave survives backgrounding; 4 tickets to Parity.

Risk: the 17-step wizard is large. Mitigation: drive it from a declarative step
config shared with web so steps/validation aren't re-authored; ship behind the
`comingSoon` guard until all steps land, then flip once.

### Sprint 7 — Parent gradebook, lessons, homework, IEP, profile-v2

Scope (tickets): MOB-PAR-008 (gradebook: subject averages, per-skill table,
recent runs — chart kit), MOB-PAR-011 (plain-language lesson recaps),
MOB-PAR-009 (homework summary view), MOB-PAR-010 (IEP + review sub-flow),
MOB-PAR-012 (profile-v2 metric hub).

Acceptance: 5 tickets to Parity. **Parent learner-management hub complete.**

---

## Phase 4 — Parent account & compliance

### Sprint 8 — Consent center, reports, schedule, privacy

Scope (tickets): MOB-PAR-018 (consent/approvals center, account + per-learner
COPPA), MOB-PAR-020 (parent reports), MOB-PAR-021 (schedule), MOB-PAR-022
(privacy hub + data-export + delete-data requests), MOB-PAR-019 (notifications
parity — read state + live stream), MOB-PAR-023 (account settings sub-screen).

Acceptance: 6 tickets to Parity. **Parent role reaches ~100% parity.** Privacy
request flows audit-logged identically to web.

Risk: data-export/delete are compliance-sensitive — reuse the exact web request
contracts and confirmation copy; security review before merge.

---

## Phase 5 — Teacher classroom tools

### Sprint 9 — Roster, classes, curriculum, insights

Scope (tickets): MOB-TCH-001 (learners/roster list), MOB-TCH-004/005 (classes
list + class detail), MOB-TCH-002 (curriculum manager), MOB-TCH-008 (class-wide
insights list).

Acceptance: 5 tickets to Parity.

### Sprint 10 — Assignments, lesson-plan library, reports, IEP draft

Scope (tickets): MOB-TCH-006/007 (assignments list + create), MOB-TCH-009
(lesson-plan library/list), MOB-TCH-010 (classroom mastery-distribution
reports), MOB-TCH-003 (AI SMART-goal IEP draft generation).

Acceptance: 5 tickets to Parity. **Teacher role reaches ~100% parity.**

---

## Phase 6 — Close-out & launch

### Sprint 11 — Therapist / caregiver close-out + partial sweep

Scope: MOB-THR-001 (therapist cross-client reports roll-up), MOB-CGV-001
(caregiver learners list), plus a sweep of any remaining `Partial` rows surfaced
by the parity test (e.g. MOB-LRN-001 multi-learner picker, MOB-PAR-019 residue).

Acceptance: zero `Missing`, zero unintended `Partial`; `pnpm mobile:parity`
shows 100% in-scope parity except items explicitly deferred with a written
rationale in the matrix.

### Sprint 12 — Offline, unified-shell cutover, hardening, release

Scope:

- **Offline queue** — replace the in-memory `useOffline` queue with an
  `expo-sqlite` persistent queue per `docs/mobile/unified-app-contract.md`
  (item shape `{ idempotencyKey, lessonRunId, payload, queuedAt }`, flush on
  reconnect, 7-day staleness drop). Lesson + baseline submissions enqueue
  offline.
- **Unified shell cutover** — complete Sprint 09c migration: move remaining
  per-role screens under the unified `(app)` shell, delete legacy role-group
  dirs, flip `MOBILE_UNIFIED_APP` default to `true`, remove the flag; update
  `mobile:audit` to assert legacy dirs are gone.
- **Hardening** — performance pass (list virtualization, image caching), full
  a11y audit (screen reader, switch scanning, dynamic type), E2E across all five
  roles, store-submission checklist.

Acceptance: `pnpm mobile:parity:strict`, `pnpm mobile:audit`, mobile test suite,
and the five-role E2E all green; app submitted to TestFlight + Play internal
track.

---

## Timeline at a glance

| Sprint | Phase           | Focus                                         | Tickets closed (cum.) |
| :----: | --------------- | --------------------------------------------- | --------------------- |
|   S1   | Foundations     | Nav areas, hooks, chart kit, stream           | infra                 |
|   S2   | Onboarding/A11y | Full onboarding + accessibility               | ~16                   |
|   S3   | Learner         | Subjects, progress, library, missions, notifs | ~22                   |
|   S4   | Learner         | Baseline runner, lesson host, quests, brain   | ~27 (learner done)    |
|   S5   | Parent hub      | Roster, profile, settings, sensory, summary   | ~35                   |
|   S6   | Parent hub      | Assessment wizard, baseline, clone approval   | ~39                   |
|   S7   | Parent hub      | Gradebook, lessons, homework, IEP, profile-v2 | ~44                   |
|   S8   | Parent acct     | Consent, reports, schedule, privacy           | ~50 (parent done)     |
|   S9   | Teacher         | Roster, classes, curriculum, insights         | ~55                   |
|  S10   | Teacher         | Assignments, lesson-plans, reports, IEP draft | ~60 (teacher done)    |
|  S11   | Close-out       | Therapist/caregiver + partial sweep           | ~62                   |
|  S12   | Launch          | Offline, unified shell, hardening, release    | 100% in-scope         |

**~12 sprints (~24 weeks / ~6 months)** to full in-scope parity with one squad.
Parent (S5–S8) is the critical path — it is half the gap. If staffed with two
squads, Phases 2 (learner) and 3 (parent) can run in parallel after S2,
compressing the calendar to roughly **4 months**.

## Sequencing rationale

1. **Foundations first (S1)** so feature sprints are screen-only, not plumbing.
2. **Onboarding next (S2)** — without it, new mobile users cannot activate; it
   also unblocks per-learner/accessibility infra reused everywhere.
3. **Learner before parent** — learner is fewer gaps and lower risk, builds the
   chart kit / session patterns that parent gradebook/progress reuse.
4. **Parent is the bulk** (33 gaps) and sits on the critical path.
5. **Teacher** is self-contained and can slip without blocking families.
6. **Offline + unified-shell cutover last** — they touch every screen, so they
   land once the screen set is stable, avoiding repeated migration churn.

## Tracking & exit criteria

- Every sprint ends with `pnpm mobile:parity` re-run and `docs/mobile-parity.md`
  regenerated (`pnpm mobile:parity:md`); the PR shows the delta.
- `pnpm mobile:parity:strict` in CI blocks merges that add a web route without a
  matrix entry — parity cannot silently regress.
- **Exit:** parity test reports 0 `Missing`, 0 unintended `Partial` for all five
  roles; offline queue persistent; unified shell default; five-role E2E green.

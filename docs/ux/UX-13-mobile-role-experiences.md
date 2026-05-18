# UX-13 — Unified Mobile Role Experiences: Parent, Learner, Teacher, Admin-Lite

> **Last refreshed**: 2026-05-17 — drafted in this sprint. Companion to UX-12 (architecture / role switching); this doc owns the **per-mode experience inside the unified shell**.
>
> **Source of truth.** Grounded in `apps/mobile/app/{(parent),(learner),(teacher),(caregiver),(therapist),(auth)}/**` (today's five fragmented role groups + auth group) and the role contract in `apps/web-v2/lib/auth/types.ts`. The shell migration itself is DD-04 (P0) in UX-00 and the architecture target is UX-12 §3.
>
> **Status legend:** ✅ shipped (web parity exists, mobile equivalent exists in current group) · 🟡 partial (mobile screen exists but doesn't yet honor the unified-shell contract) · ⬜ planned (no mobile screen today).

---

## 1. Why per-mode experiences are documented separately

UX-12 says _one app, four modes_. This doc says _what each mode actually contains_. The four modes — **Parent**, **Learner**, **Teacher**, **Admin-Lite** — are not five-way symmetric; each has a different center of gravity and a different "what should I do now?" answer. Documenting them together with the same column shape (purpose · primary CTA · tabs · key screens · empty/loading/error · offline · accessibility) is how we keep the modes feeling like one product instead of four pasted-together apps.

`(caregiver)` and `(therapist)` from today's mobile route groups do not appear as first-class modes here. UX-00 §11 flagged that they have no web counterpart. The proposal: **caregiver folds into Parent Mode** (a caregiver is a delegated parent — same readiness rail, same inbox, with billing + privacy hidden behind the Parent Lock); **therapist folds into Teacher Mode** (a therapist's clients are learners, the workflow is class-detail + learner-detail + assignments). Final disposition is a product decision, but every screen in those two groups maps cleanly into one of the four modes below.

---

## 2. Parent Mode

**Purpose.** Make the next step obvious for every learner this parent has. Mirror the web parent app's readiness-first mental model from UX-04.

**Primary CTA.** The single CTA from `nextStepFor(activeLearner)` — the same `lib/learner/readiness.ts` function that drives the web parent home. The parent does not see metrics; they see "Start parent assessment", "Continue assessment", "Upload IEP", "Start baseline", or "Open today's lesson summary".

**Tabs.**
| Tab | Purpose | Today's source |
|---|---|---|
| Home | Learner rail + inbox | `(parent)/index.tsx` 🟡 |
| Learners | Per-learner detail (brain, IEP, progress, milestones, team, colearn) | `(parent)/{brain,iep,progress,milestones,team,colearn}/[childId].tsx` 🟡 |
| Progress | Aggregate progress across learners | `(parent)/progress/[childId].tsx` (per-learner only today) ⬜ |
| Notifications | Comms-svc topic feed, role-aware | shared (see §6) ⬜ unified |
| Settings | account · billing · accessibility · language · consent · privacy | `(parent)/{settings,billing}.tsx` 🟡 |

**Key screens.**

- **Inbox** (`(parent)/inbox.tsx` 🟡). One row per "AIVO needs you" item: pending consent, assessment to finish, IEP review, baseline result to review, lesson summary unread. Each row's CTA matches the web `nextStepFor` chip. Mirrors the planned web `/parent/inbox` (UX-00 DD-05).
- **Learner detail tabs** (`(parent)/brain/iep/progress/milestones/team/colearn/[childId].tsx`). All seven sub-screens already exist as separate routes; under the unified shell they become tabs inside `/learner/[id]` with a sticky header showing avatar + readiness Badge. The web side has `/parent/learners/[id]/{gradebook,milestones,sensory,team}` shipped today — mobile is on parity, just unrouted.
- **Recommendations** (`(parent)/recommendations.tsx` 🟡). A "what AIVO suggests" rail — keep behind the Inbox tab as a secondary card; do not promote to top-level nav (would violate the one-primary-CTA rule).
- **Co-learn** (`(parent)/colearn/[childId].tsx`). Parent-as-learner mode (parent runs baseline / lesson alongside the child). Mirrors web's `?as=parent` baseline mode (UX-07 §1).
- **Tutors directory** (`(parent)/tutors.tsx`). Read-only roster of the 14 tutors with plain-language descriptions. Place under Learner detail or Settings — not a top-level tab.

**Empty / loading / error.**

- Empty: no learners → `<EmptyState>` "Add your first learner" → `(parent)/onboard.tsx`.
- Loading: skeleton list of learner cards.
- Error: per-row `<ErrorState>` with retry; surface a Toast for full-screen failures.
- Consent revoked: per-learner card swaps CTA to "Restore consent" routing into Settings → Consent.

**Offline.** Inbox + learner detail must render last-cached state with an `<OfflineBanner>` at top. Writes (consent toggle, billing change) require online; show "Reconnect to save" inline.

**Accessibility.** Same a11y contract as web Parent (UX-14). Native: respect `accessibilityElements` ordering, label every Pressable, never rely on color alone for readiness tone.

**Parent Lock.** Settings → account, billing, consent, privacy, IEP upload all sit behind a PIN-entry modal driven by `(auth)/pin.tsx`. Parent Lock is mandatory before role-switch _away from_ Parent Mode (UX-12 §4).

---

## 3. Learner Mode

**Purpose.** Answer "what should I do now?" in two taps or fewer. One mission, one button, full-bleed Stage on tap.

**Primary CTA.** `Start today's mission` / `Resume`. Driven by the same `pickTodaysMission` chain from UX-08 / UX-05; the mobile Today screen never lists alternates above the fold.

**Tabs.**
| Tab | Purpose | Today's source |
|---|---|---|
| Today | Today's Mission + plain-language reason | `(learner)/index.tsx` ✅ |
| Lesson | Active LessonRun (deep-link target — `/learner/stage/[sessionId]`) | `(learner)/stage/[sessionId].tsx` ✅ |
| Subjects | Subject grid (mastery word, not number) | ⬜ — split today across `(learner)/{brain,gradebook,quests}` |
| Quests | Opt-in worlds | `(learner)/quests/index.tsx` 🟡 |
| Homework | Helper sessions | `(learner)/homework/{index,[sessionId]}.tsx` ✅ |
| Progress | Mastery + recent runs (word-level only) | `(learner)/gradebook.tsx` 🟡 |

**Key screens.**

- **Stage** (`(learner)/stage/[sessionId].tsx`). Full-screen, no chrome, one beat at a time. Mirrors UX-06 contract: no run is created on this URL — the run already exists. Status states (`generating`, `failed`) follow UX-15 §3 patterns.
- **Tutor view** (`(learner)/tutor/[tutorSlug].tsx`). A friendly "meet the tutor" surface; reached from the Stage's tutor avatar, never as a top-level tab.
- **Adventure / badges / shop / leaderboard / challenges / gamification** (six screens in current `(learner)/*`). Under the unified shell, these are consolidated under **Quests** + **Progress** + a single optional "Rewards" Card. The current six-way fragmentation is a major source of learner confusion (UX-00 §8 LC-01).
- **Brain** (`(learner)/brain.tsx`). Learner-safe view of the brain profile (tutor name, learning style in kid words — never functioning level). Place inside Progress or as a "Meet your AIVO" card.

**Empty / loading / error.**

- Empty (pre-baseline): full-bleed `<EmptyState>` "Your tutor is getting ready" + parent-action explainer (kid-safe, not "go ask your parent" — softer: "A grown-up will start this with you"). Per UX-07 §3 copy.
- Loading: a single skeleton card + a calm animation that does **not** look like progress (no progress bar).
- Error: friendly Card with a Retry button. Never expose status codes. Per UX-15 §4.
- Generation in flight: a "Your tutor is thinking" screen with optional skip-to-text-mode after 8s. Per UX-15 §3.

**Offline.** Most learner content is online-only by design (real-time tutor). Lesson responses **must queue while offline and flush on reconnect** (UX-00 mobile risk MR-03). Homework Helper chat must show "You're offline — your tutor will reply when you reconnect" as the last message bubble.

**Accessibility.** Larger tap targets (`accessibilityRole="button"` with min 56pt), captions on by default for any video, TTS for prompts (uses `(parent)/settings → audio` preferences), AAC switch input for tap-anywhere mode. Reduced motion respected — Stage animations gate on `AccessibilityInfo.isReduceMotionEnabled()`.

**No parent surfaces.** Billing, consent, privacy, IEP, account email — none of these are reachable from Learner Mode. The role switcher prompts for PIN before leaving Learner Mode (UX-12 §4).

---

## 4. Teacher Mode

**Purpose.** Answer the three teacher questions from UX-10 §1: _who needs attention, what are they working on, what should I assign or review next?_

**Primary CTA.** Context-dependent: from Home → tap "needs attention" rail; from a class → "Open class roster"; from a learner → "Open IEP draft" or "Open insight"; from Assignments → "Create assignment" (FAB).

**Tabs.**
| Tab | Purpose | Today's source |
|---|---|---|
| Home | Classes + needs-attention rail | `(teacher)/index.tsx` 🟡 |
| Classes | List + class detail | ⬜ — class detail is web-only today |
| Learners | Roster + learner detail (web `/teacher/learners/[id]`) | `(teacher)/student/[id]/index.tsx` ✅ |
| Assignments | Tracking + create | ⬜ |
| Notifications | Class/learner alerts | shared (§6) ⬜ |

**Key screens.**

- **Learner detail** (`(teacher)/student/[id]/{index,insight,iep}.tsx`). Three sub-screens already exist. `student/[id]/iep.tsx` shows the **teacher-safe accommodations summary only** (never the raw IEP — UX-00 §7 PR-01). `insight.tsx` shows mastery delta + recent runs. Wire to web `/teacher/learners/[id]` via deep link.
- **Analytics** (`(teacher)/analytics.tsx`). A class-level view. Keep behind Class → "Class analytics" link rather than as a top-level tab.
- **Lesson plan** (`(teacher)/lesson-plan.tsx`). Read-only mobile view of the web `/teacher/lesson-plans` workspace (creation is desktop-only).

**Empty / loading / error.** Same patterns as Parent Mode.

**Offline.** Read-only mode acceptable; create-assignment and assign-to-learner require online. Show inline "Online required" on disabled CTAs.

**Accessibility.** Dense data needs solid VoiceOver/TalkBack table semantics — every roster row reads "name, mastery word, last-active, needs-attention flag" without redundant chrome.

---

## 5. Admin-Lite Mode

**Purpose.** Operational visibility on the go. **Not** a full admin surface — full admin is web-only (UX-11). Mobile Admin-Lite is read + acknowledge + page-on-call, not create/configure.

**Primary CTA.** Acknowledge the top alert. Drill in for detail.

**Tabs.**
| Tab | Purpose | Today's source |
|---|---|---|
| Alerts | Ops + security alerts feed | ⬜ entirely |
| AI failures | Recent failed generations + retry | ⬜ |
| Rostering status | Last sync per district, partial-failure detail | ⬜ |
| Support | Open tickets, paging targets | ⬜ |

**Allowed actions.** Acknowledge alert · Trigger retry on a single failed generation · Open ticket via comms-svc · Trigger rostering re-sync.

**Forbidden actions.** Tenant create/delete · User role change · Billing edit · Curriculum edit · Safety policy edit · Secrets management. These are web-only; tapping them surfaces "Open on web" with a deep link.

**Empty / loading / error.** Empty alerts → "All clear" Card. Loading → skeleton. Error → retry per row.

**Offline.** Cached last-known alert state with prominent stale-as-of timestamp. Acknowledge is queued.

**Accessibility.** High-contrast theme variant by default in this mode (admins are often paged at night).

---

## 6. Shared surfaces (every mode)

These four screens live in every mode under the "More" menu and switch their content based on the active mode:

| Screen                   | Content rule                                                                                                                              | Today                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Notifications center     | Filter to current mode's topics (parent gets learner-events, teacher gets class-events, etc.); Settings → Notifications controls channels | ⬜ unified surface                                        |
| Settings · Account       | Email / display name / password / PIN / 2FA                                                                                               | `(auth)/change-password.tsx` ✅ partial                   |
| Settings · Accessibility | Text size, reduced motion, high contrast, dyslexia-friendly font, captions default                                                        | ⬜ (web parity: `apps/web-v2/app/settings/accessibility`) |
| Settings · Language      | App language (10 locales via `next-intl` parity), TTS voice locale                                                                        | ⬜                                                        |

The role-switcher itself is **not** under Settings — it sits in the always-visible top bar (UX-12 §3).

---

## 7. Migration plan (from today's five route groups → four modes)

| Today's group | Disposition                    | Notes                                                                                                                                                          |
| ------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `(parent)`    | Becomes Parent Mode            | Existing 14 screens map 1:1 into Parent Mode tabs (§2)                                                                                                         |
| `(learner)`   | Becomes Learner Mode           | Existing 14 screens consolidate; the 6 gamification screens collapse under Quests/Progress                                                                     |
| `(teacher)`   | Becomes Teacher Mode           | Existing 7 screens map 1:1 into Teacher Mode tabs (§4)                                                                                                         |
| `(caregiver)` | Folds into Parent Mode         | 3 screens (`index`, `notifications`, `settings`) merge with Parent equivalents; caregiver is a delegated parent                                                |
| `(therapist)` | Folds into Teacher Mode        | 7 screens (`client/[id]/{index,goals,notes,reports}`, `sessions`, `settings`, `index`) become teacher learner-detail tabs with a "therapist scope" data filter |
| `(auth)`      | Stays as auth group, pre-shell | No change                                                                                                                                                      |

After migration, the shell `app/(tabs)/_layout.tsx` (per UX-12 §3) chooses the active tab set from the current mode in `lib/auth/active-mode.ts`. No route-group `_layout.tsx` per role.

---

## 8. Deliverables

1. ✅ This per-mode contract.
2. ⬜ Unified `(tabs)` shell wired (UX-12 deliverable, prerequisite for this doc landing in code).
3. ⬜ Mode-aware tab manifest in `apps/mobile/lib/mode/tabs.ts`.
4. ⬜ Caregiver / therapist data-scope adapters so existing screens render correctly under Parent / Teacher.
5. ⬜ Per-mode E2E test (Detox or Maestro) that boots into each mode and confirms the tab set + primary CTA.

---

## 9. Acceptance criteria

- [ ] Every mode has a single primary CTA above the fold on its Home tab.
- [ ] Learner Mode never reaches a parent surface without a PIN unlock.
- [ ] Parent Mode renders `nextStepFor(activeLearner)` as the single hero CTA (parity with web UX-04).
- [ ] Teacher Mode answers the three UX-10 §1 questions on the Home tab without scrolling.
- [ ] Admin-Lite Mode shows zero "create" / "delete" / "configure" actions; create surfaces deep-link to web.
- [ ] Switching modes never re-authenticates; it re-renders the tab set in <300ms.
- [ ] Every mode honors offline read with a clear offline banner and queues writes.
- [ ] Caregiver and therapist no longer exist as sibling route groups.

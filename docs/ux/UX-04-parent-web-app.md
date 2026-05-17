> Status: **draft for review** · Sprint UX-04 · scope = `apps/web-v2/app/parent/**` · **Last refreshed**: 2026-05-17 (assessment wizard: 6 → 8 steps + four legacy-parity sections `basics`/`strengths`/`background`/`learning_profile`; brain-profile §4.7 updated for `LearnerBrainProfileState` v2 + atomic clone gate `prepareBrainCloneFromSummary` + `commitBrainClone`).

# Sprint UX-04 — Parent Web App UX

**Scope**: every parent-facing surface on web (`apps/web-v2/app/parent/**` — 28 routes today). Mobile Parent Mode is covered by UX-12 + UX-13; parent auth + consent + onboarding is covered by UX-03; this doc owns the steady-state parent app.

**Source of truth (today)**:
- Routes: `app/parent/**` (28 `page.tsx` files — see §2 sitemap).
- Readiness model: `lib/learner/readiness.ts` (`ReadinessState`, `READINESS_LABEL`, `READINESS_TONE`, `nextStepFor` — the canonical "what does the parent do next?" function).
- Components: `components/parent/learner-card.tsx` + the shared `components/ui/*` (19 primitives) + `components/layout/{app-shell,page-header,role-shells}` (AppShell + PageHeader + SectionHeader + PARENT_NAV).
- Mental model: parent app is **learner-card-driven**, not chart-driven. Every learner card carries a readiness Badge + an optional functioning-level chip + one CTA (`nextStepFor(learner).label` → `.href`). The parent never has to interpret AI metrics — the next action is always rendered.

Status legend: ✅ shipped · 🟡 partial · ⬜ planned.

---

## 1. Principles

1. **One next action per learner, always.** `nextStepFor()` is wired from `readinessState`; the card's CTA and the Learner Profile page's hero CTA both render the same href. No dead buttons — every readiness state maps to a real, reachable route. (Already enforced — see `lib/learner/readiness.ts`.)
2. **Plain language first.** Readiness labels (`"Assessment needed"`, `"Add an IEP (optional)"`, `"Ready for today's mission"`) and progress summary copy use parent-friendly phrasing — never `"functioning_level=PRE_SYMBOLIC"` or `"mastery=0.42"`.
3. **No diagnostic labels in surface copy.** "ADHD", "dyslexia", "ASD", "MID/severe" never appear in conversational copy. Accommodations are surfaced as *what AIVO did* ("AIVO gave shorter steps today"), not *why* in clinical terms.
4. **No raw IEP text.** The IEP review page shows extracted accommodations (read-aloud, extra time, smaller steps), never the source PDF's prose. Source PDF is downloadable from the IEP page only; it never leaks into summary cards.
5. **Calm density.** Parent home and learner profile are card layouts, not data tables. Dense tables are reserved for `/parent/reports` and `/parent/learners/[id]/lessons` where a power-user parent is expected.
6. **Multiple learners feel symmetric.** Every learner card is the same shape. The card renders two Badges (readiness state + optional functioning-level chip when present) and one CTA — the only things that vary per card are the readiness Badge tone, the functioning-level chip presence, and the CTA label. Adding a 4th learner doesn't introduce a new pattern.
7. **Mobile = Parent Mode in unified app** (UX-12 + UX-13). The web parent app's information architecture is mirrored — same screens, same `PARENT_NAV` order, same CTAs — but with bottom tabs instead of a sidebar.

---

## 2. Parent sitemap (web — 28 routes)

```
/parent
├── /home                                          ✅ learner-card grid + Add learner CTA + EmptyState
├── /learners                                      ✅ same data as /home, list density
├── /learners/new                                  ✅ create learner → writes AgeGateRecord
├── /learners/[learnerId]                          ✅ profile + hero next-step CTA + tabs
│   ├── /assessment                                ✅ parent assessment wizard (Stepper)
│   │   └── /review                                ✅ submitted answers, edit-and-resubmit
│   ├── /iep                                       ✅ upload-or-skip; records iep_document_storage consent
│   │   └── /review                                ✅ extracted accommodations + source link
│   ├── /brain-profile                             ✅ tutor + style + tone summary
│   ├── /baseline                                  ✅ baseline run status + readiness gate
│   ├── /lessons                                   ✅ recent LessonRuns; row → lesson summary
│   ├── /progress                                  ✅ mastery-by-subject + lifetime stats
│   ├── /summary                                   ✅ plain-language week summary
│   ├── /homework                                  ✅ homework sessions per learner
│   ├── /settings                                  ✅ per-learner display + grade + pronouns
│   ├── /accessibility                             ✅ per-learner accessibility prefs
│   │   └── /audio                                 ✅ TTS voice + rate + read-aloud defaults
├── /consent                                       ✅ account-scoped CONSENT_TYPES (UX-03 §3.3)
│   └── /[learnerId]                               ✅ per-learner CONSENT_TYPES (UX-03 §3.4)
├── /privacy                                       ✅ rights overview (export · delete · IEP-delete)
│   ├── /data-export                               ✅ records data_export_request, queues job
│   └── /delete-data                               ✅ records data_deletion_request, starts 14d window
├── /notifications                                 ✅ in-app notification center
├── /reports                                       ✅ multi-learner growth rollup (dense table OK here)
├── /schedule                                      ✅ weekly cadence + assigned/parent-pinned items
└── /settings
    ├── /account                                   ✅ profile, email, password, MFA
    └── /billing                                   ✅ plan, payment method, invoices
```

`PARENT_NAV` order (from `components/layout/role-shells.tsx`): **Home · Learners · Schedule · Reports · Privacy · Notifications · Settings**. Privacy *is* in the primary nav (DD-04 reversed — consent rights are surfaced, not buried). Consent management (`/parent/consent`) is reached from `/parent/privacy` and from contextual banners on learner-scoped surfaces, not from the primary nav. Billing lives under `PARENT_SETTINGS_NAV` (Overview · Account · Billing) which appears as a sub-nav when on `/parent/settings/*`.

---

## 3. Readiness model (canonical — drives every parent CTA)

This is the core mental model. Six states, six labels, six next-step hrefs. **Every parent surface that shows a learner uses this same triplet.**

| `ReadinessState` | Badge label | Badge tone | Next-step label | Next-step href |
|---|---|---|---|---|
| `profile_created` | Profile created | neutral | Start parent assessment | `/parent/learners/{id}/assessment` |
| `assessment_needed` | Assessment needed | warning | Continue parent assessment | `/parent/learners/{id}/assessment` |
| `iep_optional` | Add an IEP (optional) | primary | Add an IEP or skip | `/parent/learners/{id}/iep` |
| `baseline_needed` | Baseline assessment ready | primary | Start baseline assessment | `/parent/learners/{id}/baseline` |
| `ready_for_today_mission` | Ready for today's mission | success | Open today's mission | `/parent/learners/{id}` |
| `active_learning` | Active learning | success | See growth report | `/parent/learners/{id}` |

`refreshLearnerReadiness(learnerId, tenantId)` is called at the top of every parent surface that renders a learner card or hero (e.g. `app/parent/home/page.tsx`, `app/parent/learners/[learnerId]/page.tsx`) so the Badge + CTA are always fresh. Never cache. Already pattern across the app.

---

## 4. Screen-by-screen spec

For each surface: **Purpose · Primary CTA · Secondary actions · Data deps · States (loading / empty / error / retry) · Consent · A11y · Mobile**.

### 4.1 `/parent/home`

- **Purpose**: surface every learner + their single next action.
- **Primary CTA**: per-card `nextStepFor(learner).label` button → `.href`. Page-level `Add learner` in `PageHeader.actions`.
- **Secondary actions**: each card has `Open profile` (outline button) as the always-present escape hatch.
- **Data deps**: `listLearnersForParent(userId, tenantId)` → for each learner: `refreshLearnerReadiness` then `LearnerCard`.
- **States**:
  - **Loading**: `parent/loading.tsx` skeleton — `<PageHeader>` placeholder + 3 `<Skeleton>` card rectangles in the same grid (`sm:grid-cols-2 xl:grid-cols-3`). ⬜ planned (today loads synchronously via server component; a streaming + Suspense boundary is the DD-09 backlog item).
  - **Empty**: `<EmptyState>` with title `"No learners yet"`, description `"Add your first learner to begin assessment and personalize their learning path."`, action `Add your first learner` → `/parent/learners/new`. ✅
  - **Error**: shell-level error boundary (Next.js `error.tsx`) — 🟡 today the surface throws to the global error route; promote to a per-section `<RetryPanel>` so adding a learner is still possible if readiness refresh fails for one card. ⬜ planned.
  - **Retry**: per-card "Try again" inside the future `<RetryPanel>`; page-level via reloading the route (server component).
- **Consent**: shows the global consent banner (§3.5 in UX-03) when `parent_account_terms` is missing/expired, or when any learner is missing `child_data_collection`.
- **A11y**: each card uses `<Card role="article">` (composite enhancement ⬜), Badge text has explicit `aria-label` describing the state, the CTA is a `<Button asChild><Link>` so it's keyboard-reachable. Heading hierarchy is h1 (PageHeader) → h2 (SectionHeader) → h3 (LearnerCard).
- **Mobile**: stack to single column, CTA is full-width.

### 4.2 `/parent/learners` (list)

Same data as `/home` in a denser list layout for parents with many learners (district / foster / extended-family use cases). Single sort (most-recent-activity first). Row shape: avatar + name + Badge(readiness) + CTA(nextStepFor). 🟡 today renders in the same card grid as `/home`; the dense list variant is ⬜ planned.

### 4.3 `/parent/learners/new`

Detailed in UX-03 §3.2 step 2 (writes `AgeGateRecord`, collects `child_data_collection`). On submit → `/parent/learners/[id]` with the `profile_created` state and a single CTA "Start parent assessment".

### 4.4 `/parent/learners/[learnerId]` (learner profile)

- **Purpose**: single learner overview — readiness Badge, next step, profile basics, tabs into deeper sub-pages.
- **Primary CTA**: hero card with `<LearnerAvatar size="lg">` + `nextStepFor(learner).label` Button (large, primary). This CTA is **always identical to** the LearnerCard CTA on `/parent/home`.
- **Secondary actions**: `Settings` button in `PageHeader.actions`; section anchors → tabs across the page for Assessment, IEP, Brain profile, Baseline, Lessons, Progress, Summary, Homework, Accessibility.
- **Data deps**: `parentCanAccessLearner` guard → `refreshLearnerReadiness` → `getLearner` → render. Today this is one server component; sub-pages are sibling routes that fetch their own slice.
- **States**:
  - **Loading**: ⬜ planned — section-level Suspense + skeleton (today: synchronous server render, instant for the in-memory store).
  - **Empty**: not applicable (learner always exists at this URL or it's a 404).
  - **Error**: ✅ `notFound()` for unauthorized + missing.
- **Consent**: `child_data_collection` revoked → render a `<RetryPanel>` covering all sub-tabs except the consent CTA back to `/parent/consent/[learnerId]` (⬜ planned; today the page still renders).
- **Mobile**: hero card stacks (avatar above text); tabs become a horizontal scrollable strip.

### 4.5 `/parent/learners/[id]/assessment` + `/review`

Wizard (`<Stepper>`) — **8 steps, 17 sections** — derived from `lib/validators/parent-assessment.ts → WIZARD_STEPS` + `ASSESSMENT_SECTION_ORDER`. Each step shows progress out of total. Submit on the last step → `/review`, which validates every section via `validateSection(sec, current.answers[sec] ?? {})` (the `?? {}` keeps legacy drafts non-blocking — see UX-00 BF-02a).

| Step | Title | Sections collected |
|---|---|---|
| 1 | Basics | `basics` (dob, pronouns, languages) |
| 2 | Goals | `goals` |
| 3 | Background | `background` (diagnoses + services), `strengths` (loves, goodAt, motivates) |
| 4 | Confidence | `grade_subject`, `reading`, `math` |
| 5 | Focus & style | `attention`, `communication`, `learning_profile` (communicationMode, deviceInteraction, responseMethod, attentionSpanBucket, bestModes) |
| 6 | Sensory & routine | `sensory`, `homework` |
| 7 | Triggers & motivation | `frustration`, `motivation` |
| 8 | Supports & pace | `accommodations`, `pace`, `concerns` |

The four sections added in step 1/3/5 are legacy-parity (`basics`, `strengths`, `background`, `learning_profile`) — every field is optional, so any single step can be saved partially without blocking submit. `buildBrainProfile` consumes them to populate `functioningLevel`, `disabilitySignals`, `activeAccommodations`, `activeTutors`, `visualIdentity`, and `xaiExplanation` on the v2 `LearnerBrainProfileState`.

- **Loading**: `<Skeleton>` for the question list. ⬜ planned.
- **Empty (no questions for the assessment version)**: never expected — assessment version is seeded; show `<ErrorState>` with retry if it happens.
- **Error**: validation errors surface inline under each field; submit errors → toast + retain answers.
- **Retry**: submit retries are local (no network in current mock layer), but UI should treat them as retriable when a backing service is wired.
- **A11y**: each `<RadioGroup>` is `<fieldset>` with `<legend>` containing the question prompt; `<Progress>` for step count has `aria-label="Step X of Y"`.

### 4.6 `/parent/learners/[id]/iep` + `/review`

- **Purpose**: upload-or-skip; if uploaded, extract accommodations and show on `/review`. Records `iep_document_storage` consent at upload time; `skip` records an explicit skip decision so readiness can advance.
- **Constraints**: file ≤ 5 MB, content-type allow-list (PDF + DOCX). Enforced by `lib/upload-limits.ts` + the BFF at `/api/bff/learners/[id]/iep-upload`.
- **States**:
  - **Loading (upload in flight)**: button disabled + `aria-busy="true"`; progress bar if available.
  - **Empty (no IEP yet)**: large dropzone + skip button side-by-side; explainer card "We extract accommodations only — never the source text" (UX-03 §4 copy).
  - **Error (size / type / extraction failure)**: inline `<ErrorState>` with the specific reason + retry. 413 from BFF → "That file is over 5 MB. Try a smaller PDF." Extraction failure → "We couldn't read this file. You can re-upload a clearer scan or skip — your child can still start lessons."
  - **Retry**: clear and re-pick; no auto-retry.
- **Consent**: upload **records** `iep_document_storage`; revoking from `/parent/consent/[id]` triggers a 30-day purge of the source PDF (the derived accommodations remain unless `child_data_collection` is also revoked — see UX-03 §6).

### 4.7 `/parent/learners/[id]/brain-profile`

- **Purpose**: a calm, plain-language synthesis of how AIVO is teaching this learner. Tutor name + tone + lesson cadence + 2–3 sentences on style.
- **Data model**: `LearnerBrainProfileState` v2 (`BRAIN_PROFILE_SCHEMA_VERSION = 2`) carries `functioningLevel` (one of 5 levels: STANDARD → PRE_SYMBOLIC), `masteryLevels` (numeric per subject), `disabilitySignals`, `iepProfile`, `activeAccommodations`, `activeTutors`, `visualIdentity`, and `xaiExplanation`. Populated by `buildBrainProfile` from the assessment + IEP. The clone-creation gate is atomic: `prepareBrainCloneFromSummary` (read-only) feeds `commitBrainClone`, with `approvalStatus` tracking the parent-modification-before-go-live flow.
- **No diagnostic labels in surface copy.** Functioning level is **not** surfaced as a clinical label here — translated to phrases like "Lessons start with one small step" or "We pair pictures with every prompt". `xaiExplanation` is rendered in parent voice; `disabilitySignals` stays out of the visible card.
- **Primary CTA**: `Regenerate brain profile` (advanced — collapsed by default behind a `<details>` disclosure). Calls `POST /api/bff/learners/[id]/brain-profile/regenerate`. Confirmation dialog before regen (cost + impact).
- **Loading**: regenerate spinner with `aria-busy`.
- **Empty**: pre-baseline — `<EmptyState>` "We'll write this when your child finishes their baseline." with a CTA `Start baseline` (if readiness is `baseline_needed`).
- **Approval flow** (⬜ planned UI for `approvalStatus`): when the clone is in `pending_review`, show a parent confirmation card with "Approve" / "Modify" actions before the clone goes live; today the clone goes live on commit.

### 4.8 `/parent/learners/[id]/baseline`

- **Purpose**: monitor the learner's baseline run from the parent's side — status, last activity, expected length.
- **Primary CTA**: when status is `not_started`, button is `Hand the device to <learner>` → opens `/learner/baseline` in the same tab (parent intentionally exits parent mode; AppShell switches to learner shell). Confirms before exit.
- **States**: `not_started` → CTA; `in_progress` → status card with last-saved timestamp; `completed` → "Baseline complete" success card + CTA `Open today's mission`.

### 4.9 `/parent/learners/[id]/progress`

- **Purpose**: subject-mastery view + lifetime stats. Server component already shipping (`force-dynamic`).
- **Primary CTA**: contextual — when a subject is below a threshold, the row CTA is `Schedule a short review`; otherwise `See subject lessons`.
- **Layout**: card per subject with `<Progress value={…}>` + skill chips + "What's helping" 1-line (from accommodations log). Avoid charts on this page — DD-06 ("no parent-facing AI metrics").
- **Empty**: pre-first-lesson — "We'll start showing progress after your child's first lesson."
- **Mobile**: cards stack; subject-row uses a 2-col layout (progress bar + value) instead of side-by-side label/bar.

### 4.10 `/parent/learners/[id]/lessons` + lesson summary

- **Purpose**: recent LessonRuns table. Each row → lesson summary detail card.
- **Lesson summary copy** (per UX-04 brief): "AIVO gave shorter steps today" · "Your child used read-aloud support" · "Needed one extra hint on subtraction" · "A short review tomorrow may help" — all derived from `LessonRun.summary` + `accommodationsUsed` arrays (real fields in `lib/db/types.ts`). Never quote model output verbatim.
- **States**: empty pre-first-run; error per-row with retry; loading skeleton rows.

### 4.11 `/parent/learners/[id]/summary` (week summary)

A short, weekly-cadence plain-language summary card. Same copy rules as 4.10. Generated weekly — empty before the first week completes.

### 4.12 `/parent/learners/[id]/homework`

Per-learner homework history. Mirrors `/lessons` but scoped to homework-helper sessions.

### 4.13 `/parent/learners/[id]/settings`

Per-learner display: pronouns, grade band, school context, primary language, comfort levels. Edit-in-place; saving updates the LearnerProfile + refreshes the readiness state.

### 4.14 `/parent/learners/[id]/accessibility` + `/audio`

Per-learner accessibility prefs — text size, reduced motion, high-contrast (⬜ planned theme variant, but the preference toggle is wired), captions on by default for any video. `/audio` covers TTS voice, rate (slider — ⬜ Slider primitive planned, today a `<select>` with discrete steps), and read-aloud defaults. Calls `PUT /api/bff/learners/[id]/accessibility` and `PUT /api/bff/learners/[id]/audio-preferences`.

### 4.15 `/parent/consent` + `/parent/consent/[learnerId]`

Owned by UX-03 §3.3 + §3.4. Account-scoped vs per-learner.

### 4.16 `/parent/privacy` + `/data-export` + `/delete-data`

- `/privacy`: rights overview — three cards (Export · Delete account · Delete a learner's data only).
- `/data-export`: records a `data_export_request` ConsentRecord; queues an export job; shows job status + download link when ready. Pre-launch banner "Ready in a few minutes."
- `/delete-data`: records a `data_deletion_request` ConsentRecord; starts the **14-day soft-delete window** (UX-03 §3.6). Banner "You have 14 days to change your mind." Cancel button reverses.

### 4.17 `/parent/notifications`

In-app notification center. Filter chips: All · Learner activity · Account · Billing. Per-item action: `Open` (route to the underlying surface) + `Mark as read`. Bulk: `Mark all as read`. Empty: "No new updates." ✅

### 4.18 `/parent/reports`

Multi-learner growth rollup. **The one parent surface that earns a dense table** — designed for the case of 2+ learners where the parent needs side-by-side. Columns: Learner · Tutor · Subjects active · This-week minutes · Last lesson · Trend. Dense-table density tokens (UX-02 §2.2 admin scale). Sort + filter. Export to CSV. ⬜ Filter bar + Data table primitives (UX-02 backlog).

### 4.19 `/parent/schedule`

Weekly cadence — what's pinned for each learner today / this week. Per-day card with assigned lessons + parent-pinned items + suggested review windows.

### 4.20 `/parent/settings/account` + `/billing`

Standard SaaS account settings (profile, email, password, MFA — see UX-03 §6) + billing (plan, payment, invoices, change/cancel). Billing failure modes: declined card → inline error with "Update payment method" CTA; canceled subscription → grace-period banner.

---

## 5. Multi-learner switching

Two patterns, by surface:

1. **Within parent app** (the default): every "learner-scoped" route includes `[learnerId]` in the path, so switching = clicking another card on `/parent/home` or `/parent/learners`. There is **no global "active learner" picker in parent mode** — the URL is the source of truth.
2. **Parent helps learner** (`Hand the device to …` flow): the parent shell writes the `active-learner` cookie (`readActiveLearnerFromCookies` in `lib/auth/active-learner.ts`) and redirects to `/learner/home`. The learner shell reads that cookie. Returning to parent mode clears it via the role switcher in `AppShell`.

A parent navigating `/learner/*` without an active-learner cookie set is redirected to `/learner/select` to pick a learner explicitly. Already enforced in `app/learner/home/page.tsx`.

---

## 6. State matrix (parent app)

| Surface | Loading | Empty | Error | Retry | Consent block |
|---|---|---|---|---|---|
| `/parent/home` | 🟡 instant render today; ⬜ Suspense skeleton planned | ✅ `<EmptyState>` | 🟡 global err route; ⬜ per-card RetryPanel | manual reload | banner if `parent_account_terms` expired |
| `/parent/learners/new` | ✅ button busy state | n/a | inline validation + toast | resubmit | n/a (records consent itself) |
| `/parent/learners/[id]` | 🟡 instant; ⬜ Suspense | n/a | `notFound()` ✅ | manual reload | redirect to `/parent/consent/[id]` if `child_data_collection` missing ⬜ |
| `/parent/learners/[id]/assessment` | ⬜ skeleton | 🟡 if no questions seeded → ErrorState | inline + toast | resubmit | needs `child_data_collection` |
| `/parent/learners/[id]/iep` | ✅ upload progress | ✅ "upload or skip" dropzone | ✅ size/type/extract error | re-pick | needs `child_data_collection`; records `iep_document_storage` |
| `/parent/learners/[id]/brain-profile` | ✅ regenerate spinner | ✅ "after baseline" empty | inline error | manual regenerate | needs `ai_personalization` to regenerate |
| `/parent/learners/[id]/baseline` | n/a (status card only) | "not started" CTA | error → status `failed`, retry button | retry | needs `child_data_collection` |
| `/parent/learners/[id]/progress` | ⬜ skeleton rows | ✅ "after first lesson" | row-level error | manual reload | requires `child_data_collection` |
| `/parent/learners/[id]/lessons` | ⬜ skeleton rows | ✅ "no lessons yet" | row-level | retry | requires `child_data_collection` |
| `/parent/learners/[id]/homework` | ⬜ skeleton | ✅ "no homework yet" | row-level | retry | requires `child_data_collection` |
| `/parent/learners/[id]/accessibility(+/audio)` | save spinner | n/a | inline | resubmit | n/a |
| `/parent/consent(/[id])` | ✅ Toggle spinner | n/a | toast | retry | n/a (this *is* consent) |
| `/parent/privacy/data-export` | job-status card | "no exports yet" | error + retry | retry | records `data_export_request` |
| `/parent/privacy/delete-data` | confirm + 14d countdown | n/a | confirm dialog cancel | retry | records `data_deletion_request` |
| `/parent/notifications` | ⬜ skeleton | ✅ "no new updates" | inline | manual reload | n/a |
| `/parent/reports` | ⬜ skeleton + table loading row | ✅ "add a learner" | row-level | retry | requires `child_data_collection` per learner |
| `/parent/schedule` | ⬜ skeleton | ✅ "nothing scheduled" | inline | retry | requires `child_data_collection` |
| `/parent/settings/account` | save spinner | n/a | inline | resubmit | n/a |
| `/parent/settings/billing` | ✅ payment provider iframe | ✅ "no card on file" | declined-card banner | retry | n/a |

---

## 7. Copy patterns (parent)

| Context | Bad | Good |
|---|---|---|
| Readiness label | "Functioning level: PRE_SYMBOLIC" | "Lessons start with one small step at a time." |
| Lesson summary | "Mastery delta: +0.04 on skill `add_within_20`" | "AIVO gave shorter steps today. Your child made progress on adding small numbers." |
| Accommodation use | "Accommodation `read_aloud` applied" | "Your child used read-aloud support." |
| Trend | "Trend = stable (σ=0.12)" | "Steady progress this week." |
| Error: declined card | "Stripe error: card_declined" | "Your card was declined. Update your payment method to keep AIVO active." |
| Error: oversize IEP | "413 Payload Too Large" | "That file is over 5 MB. Try a smaller PDF or skip — your child can still start lessons." |
| Revocation impact | "Revoking AI personalization will degrade lesson quality." | "Your child's next lesson will use generic content. Past summaries stay visible." |

---

## 8. Engineering handoff

1. ✅ `nextStepFor()` already wired into LearnerCard and learner profile hero — keep it as the *only* CTA source for parent surfaces showing a learner. Adding a new readiness state means updating `READINESS_NEXT_STEP` and the doc table in §3 together.
2. ⬜ **Section-level Suspense + skeleton boundaries** on every learner-scoped page (DD-09). Today everything is `force-dynamic` server-render — fine for the in-memory store, but a real backing service will need streaming + skeletons. Skeleton primitives already exist (`components/ui/skeleton.tsx`).
3. ⬜ **Per-card `<RetryPanel>` on `/parent/home`** so one learner's readiness-refresh failure doesn't blank the page.
4. ⬜ **Dense list variant of `/parent/learners`** (Filter bar + Data table primitives from UX-02 §4.1 backlog).
5. ⬜ **`/parent/reports` table** — pairs with the same Filter bar + Data table.
6. ⬜ **Consent-missing redirect on learner-scoped pages** — if `child_data_collection` is revoked, redirect to `/parent/consent/[id]` with a contextual banner (UX-03 §3.5 pattern). Today the page still renders.
7. ✅ Audit trail: every state-changing action on a learner-scoped page already calls `audit(session, …)` from `lib/bff/audit.ts` (consistent with what we see in `startMissionAction`). Keep that pattern when wiring new server actions.

---

## Acceptance criteria (per UX-04 brief)

- [x] Parent can complete setup end-to-end — covered by UX-03 onboarding + the in-app `nextStepFor()` CTA chain (§3 + §4.4).
- [x] Parent always sees the next action — `READINESS_NEXT_STEP` is the canon; every learner-rendering surface uses `nextStepFor()` (§3 + §4.1 + §4.4).
- [x] Parent can understand progress without technical interpretation — §4.10 + §4.11 + §7 copy rules; DD-06 banned parent-facing AI metrics.
- [x] Parent can manage multiple learners — symmetric LearnerCard pattern (§4.1) + URL-driven scoping (§5); no global "active learner" picker in parent mode.
- [x] Parent can control accessibility preferences — `/parent/learners/[id]/accessibility(+/audio)` (§4.14).
- [x] Parent can manage privacy and consent settings — `/parent/consent` (§4.15) + `/parent/privacy/*` (§4.16); detailed in UX-03 §3 + §6.
- [🟡] Every parent surface has loading / empty / error / retry states — empty + error are uniformly covered; **loading skeletons + retry panels** are listed as ⬜ across §6 and called out as the DD-09 backlog item in §8.

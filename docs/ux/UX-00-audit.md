# Sprint UX-00 — Product Design Reset and UX Audit

**Scope**: AIVO Learning v2 web (`apps/web-v2`, Next.js 15 — 114 routes, 115 BFFs) and mobile (`apps/mobile`, Expo SDK 54). Marketing site (`apps/marketing`) is out of scope except for the signup→login→onboarding handoff.
**Audited against**: the 17-step core journey (parent signs up → learner sees Today's Mission → parent sees plain-language summary).
**Method**: route enumeration, dead-link / placeholder grep, state-file presence check, role-shell composition review, mobile group-structure review. No screenshots — visual QA happens in UX-17.

**Last refreshed**: 2026-05-17 — captures the parent-assessment expansion (wizard grew 6 → 8 steps, four new sections: `basics`, `strengths`, `background`, `learning_profile`) and the brain-clone gate (`prepareBrainCloneFromSummary` + `commitBrainClone` atomic flow; `LearnerBrainProfileState` v2 with `functioningLevel`, `disabilitySignals`, `iepProfile`, `activeAccommodations`, `activeTutors`, `visualIdentity`, `xaiExplanation`). The audit findings below reflect that state.

---

## 1. UX audit report (executive summary)

The product is in a **demo-auth state**: every signed-in surface is reachable via the mock session picker at `/login`, the data layer is honest (no fake progress, no `ComingSoon` placeholders inside dashboards), and the 114 dashboard routes all render real data from the mock store. But **the auth perimeter itself is not yet shipping** — `/signup` renders a disabled form with the literal button text "Create account (coming soon)" and a banner "Sign-up is wired to the design but disabled until Sprint 2 connects real auth", and `/login` is a mock role picker with the banner "Real authentication arrives in Sprint 2." The "school-ready in flow" claim therefore applies to the in-app journey *after* a session exists; the auth entry point is itself a P0 gap (DD-06 + DD-15 below). The dominant problems are:

1. **Visual sameness across roles** (just fixed in the prior session: each role now has its own `data-theme` driving palette/sidebar/density/radius). Pre-fix, every dashboard rendered identical chrome.
2. **A learner experience that is dashboard-first**. `/learner/home` currently leads with a "Today's Mission" card but still renders inside the same five-block nav shell as every other role, and `/learner/missions`, `/learner/library`, `/learner/quests`, `/learner/rewards` all compete for top-level attention. The Global Rule "no dashboard-first learner experience" is partially violated.
3. **Mobile is built as five role-segregated app groups** (`(parent)`, `(learner)`, `(teacher)`, `(caregiver)`, `(therapist)`) instead of one unified app with role-switching. This directly contradicts UX-12 and the Global Rule.
4. **State coverage is partial**. `loading.tsx` exists for parent/learner/teacher/admin group roots; `error.tsx` exists at app root only; per-route empty/retry states are component-level and not consistent.
5. **Consent guards are wired in 9 places**, but the consent dependency is implicit per page — there is no single "consent matrix" any reviewer can read to confirm coverage.
6. **No `not-found.tsx` per route group** — a parent who lands on `/parent/learners/<bad-id>` falls back to the global 404, which doesn't carry parent chrome.
7. **The `/` marketing-style landing page is the same surface for signed-in users and anonymous users** (fixed in prior session: now shows "Continue as <role>" + "Switch role"). Prior to fix, signed-in users hitting role cards were silently bounced to their own home via `requirePageRole`.

The product is **school-ready in the in-app flow** but **not yet shippable end-to-end**: real signup, email verification, and password reset are not wired (today is mock-auth only), the five themed dashboards exist but mobile fragments them into five sibling apps, and consent dependencies are correct in code but undocumented as a matrix. The redesign backlog (§12) prioritizes real auth, mobile unification, and the privacy/IEP exposure hardening in §7.

---

## 2. Broken flow list

Flows that exist but do not yet meet the core-journey acceptance bar.

| # | Flow | Where it breaks | Severity |
|---|---|---|---|
| BF-01 | Parent signup → consent → learner creation | `/signup` lacks an inline consent step; consent currently lives at `/parent/consent` *after* the learner already exists. Order-of-operations does not match the journey. | High |
| BF-02 | IEP upload → brain profile | `/parent/learners/[id]/iep` accepts a file and `/iep/review` shows it parsed, but there is no parent-visible status while the brain-svc processes it. Looks instant; isn't. | High |
| BF-02a | Parent assessment → brain clone | **Closed 2026-05-17.** Wizard now collects all four legacy-parity sections (`basics`, `strengths`, `background`, `learning_profile`) and `buildBrainProfile` consumes them into the v2 `LearnerBrainProfileState`. Submit + review both `?? {}` on optional sections so legacy drafts don't block. | — |
| BF-03 | Baseline → mastery map | Learner finishes `/learner/baseline/[id]`; mastery is updated in the store, but `/parent/learners/[id]/brain-profile` doesn't surface "baseline complete, mastery ready" as a notification. | Med |
| BF-04 | Learner home → LessonRun | Home shows "Today's Mission" but a learner with no active learner cookie hits `/learner/select` first — a parent helping a child has to bounce through a selector mid-journey. | Med |
| BF-05 | Teacher creates assignment → learner sees it | `/teacher/assignments/new` posts to the BFF; the learner-side surface for "assignments due" is split between `/learner/missions` and `/learner/homework` with no unified inbox. | Med |
| BF-06 | Admin DSAR request → fulfillment | `/admin/platform/compliance/dsar` lists requests, but a parent's outbound DSAR request at `/parent/privacy/data-export` does not show "received / in review / fulfilled" status. | High |
| BF-07 | Switching role on mobile | Not possible — five separate route groups (`(parent)`, `(learner)`, `(teacher)`, `(caregiver)`, `(therapist)`). No unified shell, no role chooser, no role switcher. | Critical |
| BF-08 | Account recovery | Mobile has `(auth)/reset-password.tsx` and `(auth)/forgot-password.tsx`; web has neither route under `/login/*`. Recovery is mobile-only. | High |
| BF-09 | Verify email after signup | No `/verify-email` route on web; mobile has none either. | High |
| BF-10 | Real signup | `/signup` is a disabled form ("Create account (coming soon)"); no parent can actually open an account today. | Critical |
| BF-11 | Real login | `/login` is a mock role picker; there is no email+password (or SSO) path. | Critical |

---

## 3. Missing screen list

Screens implied by the journey or the UX-01 IA below that are not yet present.

### Web
- `/verify-email` — post-signup email verification landing
- `/forgot-password` and `/reset-password` — web counterpart to mobile auth
- `/parent/inbox` — unified "things AIVO needs from you" inbox (currently scattered across home + notifications + learner cards)
- `/parent/learners/[id]/timeline` — chronological feed of brain-profile / baseline / lesson / assignment events (currently you read each subpage separately)
- `/learner/inbox` — unified "what's due" view (combines missions, homework, teacher assignments)
- `/teacher/learners/[id]/iep-summary` — teacher-safe IEP summary (de-identified accommodations only, no raw IEP)
- `/admin/platform/system-health/incidents` — operational incident timeline (security incidents exist at `/admin/platform/security/incidents` but ops incidents have no surface)
- `/admin/{school,district,platform}/notifications` — admin notification center
- `/help` and `/help/[topic]` — shared help / how-to surface

### Mobile (after unification — see UX-01 §7)
- `/welcome` — pre-auth product intro
- `/role-chooser` (post-login first-time) and `/role-switcher` (drawer)
- Parent / Learner / Teacher / Admin-Lite mode homes (currently siloed in route groups)
- `/notifications` (shared, role-aware)
- `/settings/{accessibility,language,notifications,account}` (shared)
- `/admin-lite/{alerts,ai-failures,rostering-status,support}` — entirely missing

---

## 4. Missing state list

| Surface | Loading | Empty | Error | Retry | Permission | Consent |
|---|---|---|---|---|---|---|
| Role-group roots (parent/learner/teacher/admin) | ✓ | partial | ✗ (no per-group `error.tsx`) | ✗ | implicit | implicit |
| Learner Stage / lesson player | ✓ | n/a | partial (toast) | partial | ✓ | ✓ |
| Baseline player | ✓ | n/a | ✗ | ✗ | ✓ | ✓ |
| Homework chat | ✓ | ✓ | partial | ✓ | ✓ | ✓ |
| IEP upload | partial | ✓ | partial | ✗ | ✓ | ✓ |
| Brain profile | ✗ (instant render only) | ✓ | ✗ | ✗ | ✓ | ✓ |
| Admin tables (tenants, users, audit logs, vulnerabilities, etc.) | partial | ✓ | partial | ✗ | ✓ | n/a |
| Settings forms | n/a | n/a | partial | ✗ | ✓ | n/a |

Highest-value gap: **per-route-group `error.tsx`** so a thrown error inside `/parent/*` re-renders with parent chrome and the parent's nav, not the global error boundary.

---

## 5. Design debt backlog

| ID | Item | Effort | Priority |
|---|---|---|---|
| DD-01 | Per-route-group `error.tsx` (parent/learner/teacher/admin/admin/platform) | S | P0 |
| DD-02 | Per-route-group `not-found.tsx` | S | P1 |
| DD-03 | Unified consent matrix doc + `<ConsentGate>` audit script | S | P0 |
| DD-04 | Mobile app unification — collapse `(parent)/(learner)/(teacher)/(caregiver)/(therapist)` into one shell with a role-mode switcher | XL | P0 |
| DD-05 | Replace `/parent/notifications`, `/learner/missions`, `/learner/homework` ad-hoc inboxes with a unified per-role Inbox | M | P1 |
| DD-06 | `/verify-email`, `/forgot-password`, `/reset-password` on web | M | P0 |
| DD-07 | IEP upload async status surface + brain-profile event timeline | M | P1 |
| DD-08 | DSAR request → parent-visible status chain | M | P1 |
| DD-09 | `/help` shared help surface (role-aware content) | M | P2 |
| DD-10 | Visual regression screenshot harness for the five themed dashboards | M | P1 |
| DD-11 | Lint rule: block `<Card className="… p-5 …">` reintroduction in role surfaces (density token) | S | P2 |
| DD-12 | `<Card>` and form inputs: drop residual `bg-white` (one in app-shell logo is intentional, others may creep back) | S | P2 |
| DD-13 | Dyslexia-friendly font mode + reduced-motion mode (called out in UX-02 but not wired) | M | P1 |
| DD-14 | High-contrast theme variant per role | M | P2 |
| DD-15 | Real auth — replace `/signup` disabled stub and `/login` mock picker with email+password (+ optional SSO) backed by identity-svc | L | P0 |
| DD-16 | `scripts/route-audit.mjs` extension to assert every page calls `requirePageRole` and every BFF calls `requireSession` + tenant/ownership check | S | P1 |

---

## 6. Accessibility risk list

| Risk | Where | Mitigation |
|---|---|---|
| Skip link present globally; some learner-only full-screen surfaces (Stage, baseline player) may swallow it | `app/learner/lesson-runs/[id]/lesson-player.tsx` | Verify `#main` anchor is reachable; add explicit "Exit lesson" focus target |
| Color-only signaling — Badge `tone="success/warning/danger"` is color-driven | `components/ui/badge.tsx` | Already includes text label; verify all callsites pass meaningful text |
| Focus-visible outline depends on `--color-aivo-primary` per theme; dark-sidebar (learner/platform) may have low contrast on focused nav items | `globals.css :focus-visible` | Add per-theme override that uses sidebar-fg as outline color when inside sidebar |
| `aria-live` for AI-generation states is inconsistent | grep: only 2 hits | Standardize a `<GenerationStatus aria-live="polite">` component |
| Reduced motion not honored in lesson player / quest animations | `(learner)` stage components | Wire `prefers-reduced-motion` into transition decisions |
| Form errors rely on toast only — no inline error association with the offending input | most settings forms | Add `aria-describedby` + inline error text per field |
| Tab order in admin data tables not verified after S31 additions | `/admin/platform/security/*` | Manual keyboard pass in UX-14 |

---

## 7. Privacy / IEP exposure risk list

| Risk | Where | Severity | Mitigation |
|---|---|---|---|
| Raw IEP text could appear in teacher view | `/teacher/learners/[id]` does not currently embed IEP, but no guard prevents adding it later | High | Add a `TEACHER_PRIVACY_REDACT` allow-list; only accommodations summary is teacher-visible |
| Learner-facing surfaces could leak diagnostic labels | brain-profile data is currently parent-only — but the lesson player reads brain state to adapt | Med | Verify the lesson-player adapter strips `diagnosticLabels` before render |
| DSAR status currently lacks parent verification step | `/parent/privacy/data-export` | High | Require parent identity re-confirmation (PIN or email confirm) before fulfillment |
| Cross-tenant data leak via shared BFFs | 115 BFFs — most use `requireSession` + tenant scope, but a spot-check is overdue | High | Run `scripts/route-audit.mjs` extended with tenant cross-check (see UX-01 §5) |
| Audit log retention exposed to non-admin roles | `/admin/platform/audit-logs` is platform-only ✓ | Low | Already correct, verify on each release |
| Parent of one learner could potentially view another parent's learner | parent learner endpoints scoped by `parentUserId` ✓ | Low | Already correct, but add automated test in UX-17 |
| Consent revocation does not cascade | A revoked `ai_personalization` consent currently blocks new lessons but does not retroactively redact past lesson summaries | Med | Define retention policy; surface revocation effect in UI |
| State-privacy mapping (SOPIPA, NY 2d, IL SOPPA, CO SDP, CT, Pledge) is admin-only | `/admin/platform/security/state-privacy` | Low | Already correct; ensure compliance team can export |

---

## 8. Learner confusion risk list

| Risk | Where | Mitigation |
|---|---|---|
| Multiple "next" CTAs compete on `/learner/home` (mission, library, quests, rewards in sidebar) | `LEARNER_NAV` | Demote library/quests/rewards into secondary nav; promote the single "Start today's mission" CTA |
| Mission, homework, and teacher-assignment items live on three separate screens | `/learner/missions`, `/learner/homework`, no teacher-assignment surface | Unified `/learner/inbox` (see DD-05) |
| Lesson player exit does not always confirm | `lesson-player.tsx` | Add "Are you sure?" with sensory-friendly copy |
| Streak and reward language can shame a learner who took a break | `/learner/rewards`, `/learner/progress` | Audit copy; never use "you missed", "you broke your streak" — use "your streak rests today" |
| Avatar/profile select forces a tap mid-flow when only one learner exists | `/learner/select` | Auto-advance when there is exactly one matching learner |
| Baseline can feel like a "test" | `/learner/baseline/[id]` | Reinforce "Discovery Adventure" framing on entry; never display score |

---

## 9. Parent trust risk list

| Risk | Where | Mitigation |
|---|---|---|
| Brain-profile screen uses too-technical language | `/parent/learners/[id]/brain-profile` | Plain-language layer with optional "show technical details" toggle |
| Lessons summary mixes pedagogical jargon with real progress | `/parent/learners/[id]/lessons` and `/parent/learners/[id]/summary` | One-sentence-per-day plain summary; technical view hidden behind toggle |
| No visible accountability after consent revocation | `/parent/consent` | Show "We stopped using this on <date>" history per consent type |
| IEP upload "review" implies AI read the document, but doesn't tell the parent what it pulled out | `/parent/learners/[id]/iep/review` | Show extracted accommodations as a checklist parent can confirm or correct |
| Cross-learner comparisons are not shown — but neither is "your learner's growth over time" | parent learner pages | Add 4-week trend card to learner profile |
| Billing language uses raw plan IDs | `/parent/settings/billing` | Map plan IDs to human names + per-feature explanations |

---

## 10. Teacher / Admin usability risk list

| Risk | Where | Mitigation |
|---|---|---|
| Teacher class detail does not surface the "which 3 learners need attention" answer | `/teacher/classes/[classId]` | Add a top-of-page "Needs attention" rail driven by mastery delta |
| Assignment-tracking and learner-mastery views are decoupled | `/teacher/assignments`, `/teacher/learners` | Wire assignment completion into learner detail timeline |
| Admin tables (37+ across school/district/platform) use inconsistent column ordering and filter affordances | all `/admin/**` index pages | Standardize a `<DataTable>` primitive — currently inlined per page |
| Audit-friendliness: many admin actions don't show "who did this, when, why" inline | settings + rostering pages | Embed last-modified-by per row |
| Admin "what is happening operationally" answer is split across system-health, AI-generation, AI-costs | `/admin/platform/*` | One ops overview page that links into each silo |
| Rostering import surfaces success but not partial-failure detail | `/admin/school/rostering/import` | Show per-row outcome with retry-failed-only action |
| District billing reads as platform-level data | `/admin/district/billing` | Scope tenant by middleware, surface "billed to district" framing |

---

## 11. Unified mobile app risk list

| Risk | Severity | Mitigation |
|---|---|---|
| Mobile is built as five separate role groups (`(parent)`, `(learner)`, `(teacher)`, `(caregiver)`, `(therapist)`) rather than one shell with role modes | Critical | Collapse to one app under a single `(tabs)` shell with a role-mode segmented control. Login → role chooser (one-time) → role switcher (drawer). Per UX-12. |
| `(caregiver)` and `(therapist)` exist on mobile but not on web — diverging role models | High | Decide product-wide: are caregiver and therapist first-class roles? If yes, add on web; if no, fold into parent + teacher |
| No offline mode on mobile | High | At minimum, queue learner lesson responses while offline + flush on reconnect |
| No background notification handler wired to native push | High | Wire Expo notifications to comms-svc topics |
| Auth on mobile uses PIN; web does not — mismatched recovery flow | Med | Either add PIN to web or restrict PIN to learner mode only |
| Mobile has 8 auth-related screens; web has 2 (login, signup) | High | Add `/verify-email`, `/forgot-password`, `/reset-password`, `/recover` on web |
| Role-aware deep links not designed | Med | Define `aivo://<role>/<path>` mapping + handler |

---

## 12. Recommended redesign priorities (P0 → P2)

**P0 — must ship before next school-ready release**
1. DD-15 — Replace the mock `/login` and disabled `/signup` with real auth backed by identity-svc. Nothing else ships without this.
2. DD-04 — Unify mobile app into one role-switchable shell.
3. DD-06 — Web auth recovery routes (`/verify-email`, `/forgot-password`, `/reset-password`).
4. DD-01 — Per-route-group `error.tsx`.
5. DD-03 — Consent matrix documentation + automated audit.
6. BF-01 — Move consent step inline to signup, before learner creation.

**P1 — must ship before enterprise (district) release**
6. DD-05 — Unified per-role Inbox.
7. DD-07 — IEP upload async status + brain-profile timeline.
8. DD-08 — DSAR end-to-end status visibility.
9. DD-13 — Dyslexia-friendly + reduced-motion modes.
10. Learner confusion fixes (§8) — single primary CTA on learner home.

**P2 — quality polish**
11. DD-02 — Per-route-group `not-found.tsx`.
12. DD-09 — `/help` surface.
13. DD-10 — Visual regression screenshot harness.
14. DD-11 — Lint guard for `Card p-5` density bypass.
15. DD-14 — High-contrast theme variant per role.

---

## Acceptance criteria (per UX-00 brief)

- [x] Audit covers every primary user role — parent, learner, teacher, school admin, district admin, platform admin.
- [x] Audit covers web, tablet (treated as learner-web responsive), mobile web, and native mobile.
- [x] Missing states identified — see §4.
- [x] Every place where the learner lacks a clear next action — see §8 and BF-04.
- [x] Every place where parent trust may break — see §9.
- [x] Every place sensitive data could be exposed — see §7.
- [x] Mobile split-into-separate-apps risk identified — see §11 and BF-07 (critical finding).
- [x] Prioritized redesign backlog produced — see §12.

# Sprint UX-03 — Auth, Consent, Privacy, and Onboarding UX

> **Last refreshed**: 2026-05-17 — verified current. Auth perimeter is still mock (DD-15 still P0); the 10 `CONSENT_TYPES` in `lib/db/types.ts` are unchanged; the 5-step onboarding contract in §3.2 still matches `/signup` → `/parent/consent` → `/parent/learners/new` → `/parent/learners/[id]/assessment` → `/parent/learners/[id]/iep`. The §3.2 step 4 assessment step now feeds an 8-step wizard (see UX-04 §4.5) but the onboarding gate is unchanged: completion of the wizard advances readiness.

**Scope**: every flow that establishes trust and collects sensitive child data — signup, email verification, login, password reset, parent consent overview + per-type detail, learner activation, consent management, revoked-consent states, mobile auth + role chooser + role switcher + parent lock.
**Today's state**: `/login` is a mock role picker; `/signup` is a disabled form; `/verify-email`, `/forgot-password`, `/reset-password` do not exist on web; consent records + per-learner consents are wired (`app/parent/consent/*` + `lib/db/repos.ts → recordConsent/revokeConsent`); the canonical consent types are `lib/db/types.ts → CONSENT_TYPES` (10 types — see §3.1). This sprint is the design contract — implementation is tracked as DD-15 (real auth, P0) + DD-03 (consent matrix, P0) from UX-00.

---

## 1. Principles

1. **Plain-language first.** Every consent screen leads with a one-sentence "what AIVO does with this" before any policy link.
2. **Layered consent.** Short summary card → "See full policy" disclosure → external policy URL. Never a wall of legalese as the primary surface.
3. **Required vs optional is unambiguous.** Required consents block the dependent feature; optional consents toggle it. The label says which.
4. **Parent can revoke optional consent at any time** from `/parent/consent`.
5. **Learner cannot self-activate.** A learner account only enters the Stage after a parent has accepted `child_data_collection` for that learner and (when the learner is under 13) an `AgeGateRecord` with `requiresParentConsent: true` is on file — see §3.1.
6. **Mobile Learner Mode never exposes parent settings.** Billing, consent management, IEP, privacy requests — all hidden in Learner Mode and behind the Parent Lock modal in Parent Mode.
7. **Trust before data.** Required consents are collected **before** the data they protect is requested.

---

## 2. Auth flow map

```
                            ┌──────────────┐
                            │   /signup    │  (collect: email, name, pwd, parent_account_terms, parent_privacy_policy)
                            └──────┬───────┘
                                   ▼
                            ┌──────────────┐
                            │ /verify-email│  (token from email; resend; check inbox)
                            └──────┬───────┘
                                   ▼
                       ┌─────────────────────┐
                       │ /parent/consent     │  (1st-time onboarding: required consents only)
                       │   onboarding=true   │
                       └─────────┬───────────┘
                                 ▼
                       ┌─────────────────────┐
                       │ /parent/learners/new│  (write AgeGateRecord; collect child_data_collection)
                       └─────────┬───────────┘
                                 ▼
                       ┌─────────────────────┐
                       │   /parent/home      │  (next-action card: assessment → IEP → baseline → mission)
                       └─────────────────────┘

(any time)
  /login                ───►  ROLE_HOME[role]            (resume)
  /forgot-password      ───►  email link                 (one-time token, 30-min TTL)
  /reset-password?token ───►  /login                     (success state inline)
  /account-recovery     ───►  /support                   (last-resort manual path)

(session expired)
  any request → 401     ───►  /login?return=<intent>     (preserve intended URL)
```

### 2.1 Signup screen

| Field | Notes |
|---|---|
| Name | required; min 2 chars |
| Email | required; format check |
| Password | required; ≥ 10 chars, mix; meter with `aria-live="polite"` |
| ☑ I accept the [Terms of Service](…) (v<version>) | required — recorded as `TermsAcceptance` + `ConsentRecord(parent_account_terms)` |
| ☑ I accept the [Privacy Policy](…) (v<version>) | required — recorded as `ConsentRecord(parent_privacy_policy)` |
| ☐ I want to receive AIVO product updates | optional — `ConsentRecord(marketing_opt_in)` |
| **Create account** (primary) | disabled until required fields valid + boxes ticked |
| Sign in instead | link |

States:
- **Loading**: button spinner, fields locked.
- **Empty (initial)**: only labels + placeholders, no errors shown.
- **Error**: top-of-form summary + per-field error linked via `aria-describedby`. Server errors map to `BFF.error.userMessage`.
- **Success**: redirect to `/verify-email?email=<masked>` with toast "Account created. Check your email."

Eng: replaces today's disabled stub; BFF `POST /api/bff/auth/signup` writes user + initial ConsentRecord rows + sends verification email via comms-svc.

### 2.2 Verify email screen

`/verify-email?email=<masked>&token=<optional>`

- **With token (link from email)**: server validates → success state "Email verified" → `Continue` → `/parent/consent?onboarding=true`. Bad/expired token → "This link expired" + "Send new link" CTA.
- **Without token (post-signup landing)**: "We sent a link to `r•••@example.com`." + `Resend email` (60s cooldown) + `Change email` link.

States: loading, success, expired-token, already-verified, network-error.
A11y: status announced via `role="status" aria-live="polite"`.

### 2.3 Login screen

Replaces today's mock role picker:

| Field | Notes |
|---|---|
| Email | required |
| Password | required |
| ☐ Remember this device | optional (extends refresh token) |
| **Sign in** | primary |
| Forgot password? | link → `/forgot-password` |
| Create account | link → `/signup` |
| (later) "Sign in with Google" | secondary; only after Google OAuth ships |

States:
- **Invalid credentials**: inline error "Email or password doesn't match." (Never reveal which.)
- **Unverified email**: inline warning + "Resend verification email."
- **MFA required**: redirect to `/login/verify-mfa`.
- **Session-resume (returning user)**: if a valid session exists, redirect to `ROLE_HOME[role]`.
- **Locked**: inline "Too many attempts. Try again in N minutes." (rate-limited at identity-svc.)

Eng: `POST /api/bff/auth/login` returns `{ session, role, mfaRequired? }`. The demo-mode mock picker becomes a separate `/dev/login` route only available in non-production builds (gated by `NEXT_PUBLIC_AUTH_MODE === "mock"`).

### 2.4 Forgot password + reset password

- `/forgot-password`: email field + **Send reset link**. Success state: "If that email is registered, we sent a link." (Don't reveal account existence.)
- `/reset-password?token=<…>`: new password + confirm; same strength rules as signup. Token invalid → "This link expired. Request a new one."
- Success → redirect to `/login?reset=success` (banner).

### 2.5 Account recovery (last resort)

`/account-recovery` — static page explaining: (1) try password reset first; (2) if the email is wrong/inaccessible, contact `support@aivolearning.com`; (3) what info to send (full name + tenant name + last 4 of the account ID). No self-service path — recovery requires human verification to avoid bypassing parental consent.

### 2.6 Mobile auth + role detection

| Step | Screen | Notes |
|---|---|---|
| 1 | `/welcome` | brand intro + Get started / Sign in |
| 2 | `/(auth)/login` | identical fields to web |
| 3 | `/(auth)/verify-mfa` | if required |
| 4 | `/(auth)/pin` | learner-mode quick-unlock (set once after login on this device) |
| 5 | **Role detection** | `availableRoles` from session: 1 → set + skip; 2+ → `/role-chooser` |
| 6 | `/role-chooser` | one card per available role, last-used pinned to top |
| 7 | `<Mode>` home | tab navigator renders the active mode's tabs |

`/role-switcher` (drawer): same list as `/role-chooser` + "Sign out" at bottom. Switching modes **never** re-authenticates.

---

## 3. Consent flow map

### 3.1 Consent types (canon — `lib/db/types.ts → CONSENT_TYPES`, 10 types)

These are the **exact** identifiers in the codebase. Don't invent new ones in design; add a new entry to `CONSENT_TYPES` (and a `ConsentVersion` row) first.

| Type | Scope | When collected | Required? | What it gates |
|---|---|---|---|---|
| `parent_account_terms` | account | signup | required for any signed-in use | the account itself |
| `parent_privacy_policy` | account | signup | required | the account itself |
| `child_data_collection` | per-learner | learner creation | required for the learner | all learner data collection; revoking triggers the 30-day soft-delete (§3.6) |
| `iep_document_storage` | per-learner | IEP upload step | optional | IEP upload + extracted accommodations |
| `ai_personalization` | per-learner | learner activation; default off | optional but strongly recommended | tutor personalization + adaptive lessons |
| `school_roster_import` | account / per-learner | when a school invite is accepted | required to be rostered by a school | district SIS / rostering ingest of this learner |
| `teacher_access` | per-learner | per-learner, per-teacher (auto-implied when the learner joins the teacher's class via a parent invite) | optional | teacher view of learner profile |
| `marketing_opt_in` | account | signup or parent settings | optional | product update emails |
| `data_export_request` | account or per-learner | parent triggers from `/parent/privacy/data-export` | optional (audit-style consent recorded each request) | a DSAR export job is allowed to package the data |
| `data_deletion_request` | account or per-learner | parent triggers from `/parent/privacy/delete-data` | optional (audit-style consent recorded each request) | the 14-day soft-delete window starts; cascade per §3.6 |

**COPPA**: there is **no** standalone `coppa_parental_consent` type. The COPPA path is the combination of (a) an `AgeGateRecord` (`lib/db/types.ts → AgeGateRecord`) flagging that the learner is under 13 + `requiresParentConsent: true`, and (b) a `child_data_collection` ConsentRecord from the verified parent. Both must exist before the learner can activate.

### 3.2 Onboarding consent flow

```
/parent/consent?onboarding=true
  │
  ├── Step 1: Account consents (parent_account_terms, parent_privacy_policy — accepted at signup, shown as ✓)
  │           Optional row: marketing_opt_in
  │
  ├── Step 2: Per-learner required: child_data_collection
  │           + AgeGateRecord captured here (recordedByUserId = parent, ageRange,
  │             requiresParentConsent=true if under 13 — the COPPA pairing in §3.1)
  │
  ├── Step 3: ai_personalization (optional; default off; explainer)
  │           "We can adapt every lesson to how your child thinks and focuses.
  │            We never store the conversation content beyond the lesson."
  │
  ├── Step 4: iep_document_storage (optional; defer if no IEP)
  │           "If your child has an IEP, you can upload it now or anytime later.
  │            We extract accommodations only — never quoted verbatim to teachers."
  │
  ├── Step 5: teacher_access (optional; only if a teacher invite is pending)
  │           "Your child's teacher <Name> is asking to see their AIVO progress.
  │            You can change this anytime."
  │
  └── Step 6: school_roster_import (only if a school/district invite is pending)
              "Your child's school <Name> wants to roster them in AIVO.
               This shares enrollment info between AIVO and the school's SIS."
```

Each step is a `<Stepper>` panel. "Skip for now" is visible on optional steps. Parent can return to `/parent/consent` later to flip any switch.

### 3.3 Consent overview (`/parent/consent`)

A list, not a wizard. One row per consent type with:

| Column | Content |
|---|---|
| Label | "AI personalization", "IEP storage", … |
| Status | `Accepted on Mar 12, 2026` / `Not granted` / `Revoked on Apr 1, 2026` |
| Version | "v2 — current" (or "v1 — needs re-acceptance") |
| Action | `<Toggle>` (accept/revoke) or `<Button variant="link">View details</Button>` |

Revocation is one click + confirmation dialog explaining the consequence: "Revoking AI personalization means your child's next lesson will use generic content. Past summaries remain visible."

### 3.4 Per-learner consent (`/parent/consent/[learnerId]`)

Same shape but only the per-learner subset of CONSENT_TYPES: `child_data_collection`, `iep_document_storage`, `ai_personalization`, `teacher_access`, and (when scoped per-learner) `school_roster_import`. The per-learner `AgeGateRecord` is shown read-only at the top of this surface (cannot be edited; if wrong, parent contacts support). The breadcrumb shows the learner's name. Account-scoped types (`parent_account_terms`, `parent_privacy_policy`, `marketing_opt_in`, `data_export_request`, `data_deletion_request`) do not appear here.

### 3.5 Consent missing (feature blocker)

When a parent or learner hits a gated surface without the required consent, **don't 404**. Redirect to the consent surface with a banner explaining what's blocked.

```
/learner/lesson-runs/<id>  →  needs (child_data_collection, ai_personalization)
                          →  redirect to /learner/home?blocker=consent&type=ai_personalization
```

Learner home renders:

```
┌────────────────────────────────────────────────┐
│ ⓘ Your grown-up needs to enable AI tutors      │
│   before you can start today's mission.        │
│                                                │
│  [Ask your grown-up]   [Explore subjects]      │
└────────────────────────────────────────────────┘
```

The parent-side equivalent shows the toggle inline with copy: "Turn on AI personalization so AIVO can adapt today's lesson."

### 3.6 Consent revoked (post-revocation state)

After revocation, the dependent surfaces show:

- **Learner home**: "AI tutors are turned off. We're showing you general lessons today." (Non-shaming, no diagnostic language.)
- **Parent learner card**: "AI personalization is off — turn it back on" CTA.
- **Brain profile / lessons history**: existing data remains visible with an "AI personalization was off after `<date>`" timeline marker; never deleted unless `child_data_collection` is also revoked.

Cascade rules (UX-00 §7):
- `ai_personalization` off → no new AI content; past records retained.
- `iep_document_storage` off → document purged in 30 days; derived accommodations retained until `child_data_collection` revoked.
- `child_data_collection` off → 30-day soft delete; dashboards show "data removed" tombstone with restore-window note.

### 3.7 Learner activation

When the parent finishes setup (consent ✓, learner ✓, optionally IEP, baseline started or scheduled), the learner can sign in. On the parent's device:

- `Open learner account` button → `/learner/select` → `/learner/home` (logged in as the parent, with active-learner cookie set).

On a separate device:
- `Send learner sign-in link` → emails a parent-locked link → opens `/(auth)/pin` on mobile or `/learner/select` on web; parent PIN required once per device. After PIN, the learner enters Stage directly on subsequent visits.

---

## 4. Privacy UX copy patterns

Plain-language phrasings to use across the consent surfaces. Each line is a card heading + one explainer sentence.

| Consent type | Heading | Sentence |
|---|---|---|
| `parent_privacy_policy` | "What we collect" | "Your child's responses, time-on-task, and lesson outcomes — used only to teach them and to show you their progress." |
| `child_data_collection` | "Why we ask for this" | "AIVO can't teach a child personally if it doesn't keep a memory of what they've learned." |
| `ai_personalization` | "What turns on with this" | "Lessons adapt to your child's pace, focus, and learning preferences — using their AIVO learning history." |
| `iep_document_storage` | "What we do with the document" | "We extract accommodations only — read-aloud, extra time, smaller steps. We never quote the document to teachers or learners." |
| `teacher_access` | "What the teacher sees" | "Mastery on the skills assigned in class, plus AIVO's recommended next step. No diagnostic labels. No raw IEP text." |
| `school_roster_import` | "What the school sees and sends" | "Your child's name, grade, and class roster — exchanged between AIVO and your school's information system. Lesson responses are not shared back." |
| `marketing_opt_in` | "What you'll get" | "About one email a month. We never share your address." |
| `data_export_request` | "What an export contains" | "Everything we have for your account or the learner you pick — in a portable zip. Ready in a few minutes." |
| `data_deletion_request` | "What deletion does" | "Marks your data for removal. You have 14 days to change your mind before it's gone for good." |

Always avoid:
- Diagnostic labels in conversational copy ("dyslexia", "ADHD", "ASD").
- Legalese as the lead — link to it second.
- Implication of consequences that won't actually happen ("Your child will fall behind without this").

---

## 5. Desktop screens — required state coverage

Each screen below must specify all five states + the standard handoff columns. The full matrix lives in `docs/ux/UX-01-route-matrix.json` (updated when these routes ship); below are the auth/consent-specific anchors.

### 5.1 `/signup`

| State | Surface |
|---|---|
| Default | Card with form (§2.1) |
| Loading | Submit button spinner, fields locked |
| Empty | First load — no errors |
| Error | Top-of-form summary + per-field `aria-describedby` |
| Success | Redirect to `/verify-email?email=<masked>` + toast |
| Permission blocked | n/a (public route) |
| Consent required | the form *itself* collects the two required consents |

### 5.2 `/verify-email`

| State | Surface |
|---|---|
| Default | "Check your inbox" panel |
| Loading | When clicking "Resend email" |
| Success | "Email verified — continue to setup" |
| Error | "This link expired" + Send new link |
| Already verified | Banner + Continue button |

### 5.3 `/login`

| State | Surface |
|---|---|
| Default | Form (§2.3) |
| Loading | Submit spinner |
| Error | Inline "Email or password doesn't match." |
| Unverified email | Warning panel + Resend |
| MFA required | Redirect to `/login/verify-mfa` |
| Locked | "Too many attempts" |
| Session resume | Redirect to ROLE_HOME |

### 5.4 `/parent/consent` (overview + per-type detail dialog)

| State | Surface |
|---|---|
| Default | List of consent rows (§3.3) |
| Loading | Row-level skeleton on each toggle action |
| Empty | n/a (always at least Terms + Privacy) |
| Error | Inline error on the row + retry; per `consent-toggle.tsx` today |
| Success | Toggle position updates + toast "Saved" |
| Revoked | Status pill flips + cascade note inline ("Some features will turn off — see your learners.") |

### 5.5 `/parent/consent/[learnerId]`

Same as 5.4 scoped to one learner; breadcrumb shows the learner's name; account-scoped rows (`parent_account_terms`, `parent_privacy_policy`, `marketing_opt_in`, `data_export_request`, `data_deletion_request`) are not shown here.

### 5.6 `/parent/privacy` + `/parent/privacy/data-export` + `/parent/privacy/delete-data`

- **Overview**: lists the three rights (export, delete, IEP-only delete) with last-action timestamps.
- **Data export**: form ("Export all data for <learner>") → confirmation step → status chain (pending / packaging / ready / downloaded). Today's surface is missing the status chain — fix per UX-00 BF-06.
- **Data deletion**: re-auth required (PIN or email confirm); 14-day soft-delete window; cancel during window from this surface.
- **IEP deletion**: same as data deletion but scoped to the IEP document; cascade rule per §3.6.

### 5.7 `/login/verify-mfa`

Six-digit code, 30s resend cooldown, `Use backup code` link, `Trust this device` checkbox.

---

## 6. Mobile screens

All under the unified app (UX-01 §7). Required:

| Route | Purpose | States |
|---|---|---|
| `/welcome` | Pre-auth intro | default, "already have an account" |
| `/(auth)/login` | Login | same as web |
| `/(auth)/signup` | Signup | same as web |
| `/(auth)/verify-mfa` | MFA | same as web |
| `/(auth)/pin` | Learner-mode PIN unlock | default, wrong-PIN (locked after 3), "set new PIN" first-time |
| `/(auth)/forgot-password` | Request reset | same as web |
| `/(auth)/reset-password` | Token consume | same as web |
| `/role-chooser` | After login, when >1 role | default, only-one-role (auto-skip), no-roles (lock-out + support) |
| `/role-switcher` | Drawer | default, role-unavailable warning if a delegated role was removed |
| `/(parent)/lock` | Parent lock modal | enter PIN to leave Learner Mode |

### 6.1 Mobile role protection states

| Scenario | UI |
|---|---|
| Learner Mode tries to open Settings → Billing | Hidden from nav; deep link → Parent Lock modal |
| Learner Mode session times out mid-lesson | "Your grown-up's sign-in expired. Tap to ask them to sign in." — preserves lesson state for resume |
| Parent Mode unlocks Learner Mode | 5-minute trust window (`parent.unlocked` session flag); after that, Parent Lock reappears |
| Switching to a removed role | `/role-switcher` shows "This role is no longer on your account. Sign out and sign in again." |
| Deep link `aivo://parent/billing` while in Learner Mode | Parent Lock modal first; on success switch mode + navigate |

### 6.2 Mobile protected learner handoff

When a parent hands a tablet to their learner:

1. Parent taps "Hand to learner" in Parent Mode → triggers role switch to Learner Mode + clears `parent.unlocked` flag.
2. Learner enters PIN if set, otherwise lands on `/today` directly.
3. Re-entering Parent Mode requires the parent PIN (set during onboarding).

This is the only place we ask for a learner PIN — for the parent's privacy, not for the learner's account security.

---

## 7. Engineering handoff notes

1. **Replace `/signup`** disabled stub with the real form (§2.1). Wire `POST /api/bff/auth/signup` → identity-svc; emit `TermsAcceptance` + initial ConsentRecord rows in one transaction.
2. **Replace `/login`** mock picker with the real form (§2.3); move the existing mock picker behind `/dev/login` gated on `NEXT_PUBLIC_AUTH_MODE === "mock"` (keep it for local development).
3. **New web routes** to add: `/verify-email`, `/forgot-password`, `/reset-password`, `/account-recovery`, `/login/verify-mfa`.
4. **Consent BFFs** — already exist (`POST /api/bff/consent`, `POST /api/bff/learners/:learnerId/consent`, `POST /api/bff/consent/:consentType/revoke`); the design above doesn't change the contract, only the UI shell around them.
5. **Onboarding step machine** — encode the 5-step flow (§3.2) as a server-resolved next-step (`GET /api/bff/onboarding/next-step`) so the parent always lands on the right card on refresh. Avoid client-only step state.
6. **Consent dependency map** — bake the (page → required consents) map from UX-01 §6 into `lib/auth/consent-guard.ts` so every gated surface checks once via `requireConsent(["child_data_collection","ai_personalization"])`.
7. **Mobile Parent Lock** — `parent.unlocked` is a server-side session flag, not a client flag, with a 5-minute TTL refreshed on parent activity. Never trust a client-only unlocked state.
8. **Audit** — every consent accept/revoke writes an audit log row (`audit_logs` table) with parent_user_id + learner_id + consent_type + version + ip_hash + user_agent. This is required for school-district contracts.
9. **Versioning** — when a `ConsentVersion` row is published, existing ConsentRecord rows referencing the prior version are flagged "needs re-acceptance" and the consent overview shows a banner. Block dependent features until re-accepted.

---

## Acceptance criteria (per UX-03 brief)

- [x] Parent understands what data AIVO collects and why — plain-language copy in §4, layered policy disclosure.
- [x] Parent can complete consent without confusion — 5-step onboarding (§3.2) with explicit "Skip for now" on optional steps + return path via `/parent/consent`.
- [x] Parent can skip optional IEP upload — explicit in §3.2 Step 4 + `iep_document_storage` is marked optional in §3.1.
- [x] Feature access reflects consent status — consent-required redirect spec (§3.5) + cascade rules on revocation (§3.6).
- [x] Sensitive features have clear privacy explanations — per-card copy patterns in §4.
- [x] No learner data collection flow bypasses consent UX — `requireConsent()` guard plus learner activation gated on parent consent (§3.7).
- [x] Mobile role switching respects consent, permissions, and learner privacy — Parent Lock modal + role-unavailable states + Learner Mode nav suppression (§6.1, §6.2).

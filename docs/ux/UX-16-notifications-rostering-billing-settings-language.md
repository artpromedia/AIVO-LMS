# UX-16 — Notifications, Rostering, Billing, Settings & Language

> **Last refreshed**: 2026-05-17 — drafted in this sprint.
>
> **Source of truth.** Grounded in `apps/web-v2/app/{parent,learner}/notifications/**`, `apps/web-v2/app/api/bff/notifications/**`, `apps/web-v2/app/admin/school/rostering/**` + `apps/web-v2/app/api/bff/admin/rostering/**` (district-side rostering is admin BFF only today), `apps/web-v2/app/{parent,admin/school,admin/platform}/billing/**` + `apps/web-v2/app/api/bff/{billing,admin/billing}/**`, the four role-scoped settings groups (`parent/settings`, `learner/settings`, `teacher/settings`, `admin/school/settings`), and the `next-intl` integration documented in `replit.md`.
>
> **Status legend:** ✅ shipped · 🟡 partial · ⬜ planned.

---

## 1. Why these five surfaces share a sprint

They're the operational connective tissue around the learning core: how AIVO reaches users (notifications), how districts get learners *into* AIVO (rostering), how they pay (billing), how every role tunes their experience (settings), and how the whole product speaks the user's language (i18n). None of them is a single screen — each is a cross-role contract — and each one needs the same kind of treatment: per-role surface · BFF chain · empty/loading/error · consent + permission gate · accessibility.

---

## 2. Notifications

### 2.1 Surfaces today

| Surface | Path | Status |
|---|---|---|
| Parent notification center | `app/parent/notifications/page.tsx` | ✅ |
| Learner notification chip | `app/learner/notifications/page.tsx` | 🟡 (chip only; full center planned) |
| Teacher notification center | ⬜ | planned |
| Admin alert feed | ⬜ (separate from learner notifications) | planned per UX-13 §5 |
| Notification BFFs | `app/api/bff/notifications/**` | ✅ |

Comms-svc backs delivery: email (Postmark), in-app, and — for the mobile shell — push (⬜). The same event-typed catalog feeds all three channels.

### 2.2 Notification taxonomy

| Class | Examples | Default channels | Quiet hours respected? |
|---|---|---|---|
| **Safety-critical** | `unsafe_request` parent page (UX-15 §4), consent expiration imminent | in-app + email + push | **No** — bypasses |
| **Action-required** | New consent needed, IEP re-review, baseline blocked | in-app + email | Yes |
| **Activity** | Lesson summary, weekly digest, milestone reached | in-app (digest on email) | Yes |
| **Marketing** | New feature, tutor news | email opt-in only | Yes |

Every notification carries an `eventType` from `lib/db/types.ts` notification enum + a recipient role; the role determines copy (parent-voice vs teacher-voice vs learner-voice) and the in-app deep-link.

### 2.3 Per-role contract

**Parent.** Notification center has three tabs — *Inbox* (action-required), *Activity* (summaries), *Settings* (channels). One row per item with a single CTA matching `nextStepFor()` from UX-04. Unread badge in the global header. Quiet hours configurable per learner; safety-critical bypass clearly disclosed in Settings.

**Learner.** Notification chip only — never a stream. Surface only "your tutor said hi" + "you reached a new word in [subject]". No streak-shame copy. No teacher/parent activity in this feed.

**Teacher.** Per-class notification center; default surface is needs-attention rail (UX-10 §1). Roster-sync failure shows here, not in admin alerts (teachers need to know if a class is incomplete).

**Admin.** Lives in Admin-Lite Mode (UX-13 §5) for ops-on-the-go and `/admin/platform/alerts` on web. The two feed from the same source; surface is identical except for action set (web allows configure; mobile is acknowledge-only).

### 2.4 States

- **Empty**: each tab gets `<EmptyState>` with a non-shaming line: parent "All caught up — nothing needs you right now"; learner "Your tutor will let you know when something new arrives."
- **Loading**: skeleton list (3 rows).
- **Error**: `<ErrorState>` with retry; do not lose state of items the user has already read.
- **Offline**: render cached list; outgoing acknowledgments queue.

### 2.5 Gaps

- ⬜ Teacher notification center route.
- ⬜ Push channel wiring for mobile.
- ⬜ Per-learner quiet hours (only per-parent today).
- ⬜ Digest mode (email).
- ⬜ "Snooze" action on Activity rows.

---

## 3. Rostering

### 3.1 Surfaces today

| Surface | Path | Status |
|---|---|---|
| School-admin rostering home | `app/admin/school/rostering/page.tsx` | 🟡 (scaffold) |
| Import page | `app/admin/school/rostering/import/page.tsx` + `roster-import-form.tsx` | ✅ form + BFF wired |
| Import BFF | `app/api/bff/admin/rostering/import/route.ts` | ✅ |
| Per-job status BFF | `app/api/bff/admin/rostering/import/[jobId]/route.ts` | ✅ |
| District rostering | ⬜ web route; admin BFF only | planned |

### 3.2 Provider matrix

Per `replit.md` external dependencies: Google Classroom, Clever, ClassLink, Canvas LMS. Each provider has its own connector but the UX surface is identical — provider chooser → credential check → preview diff → apply → job status.

### 3.3 The five-state import flow

| State | UX |
|---|---|
| **Idle** | Picker Card + "Last sync" timestamp + per-provider status chip |
| **Authenticating** | Spinner + provider name; never expose tokens; reduced-motion safe |
| **Preview (diff)** | Read-only table: + new learners, + changed sections, − removed learners; **explicit "Apply" gate** — never auto-apply destructive changes |
| **Applying** | Per-row progress (apply is async via job id); `aria-live` updates the visible status |
| **Done** | Summary Card: N learners added, M moved, K errors; per-row drill-in to errors |

### 3.4 States

- **Empty**: never-rostered school → primary CTA "Connect your roster" + secondary "Skip — invite manually".
- **Loading**: job status polled at 2s intervals via the per-job BFF.
- **Error**: provider error (401/403/429/5xx) surfaces in role-friendly copy + a "Retry" + "Switch provider" CTA; never the provider's raw payload.
- **Partial failure**: most-common real state — list rejected rows with reason ("missing parent email", "duplicate learner id") + downloadable CSV of failed rows.
- **Consent**: child data collection consent (UX-03 §3.1 `child_data_collection`) is **not** implicitly granted by a roster import — the parent still has to consent before the learner can do anything beyond a placeholder profile. Surface that bright line on the import success screen.

### 3.5 Gaps

- ⬜ District-level rostering web surface (today: BFF-only).
- ⬜ Provider-specific UX (Canvas vs Clever vs ClassLink credential flows).
- ⬜ Scheduled re-sync + drift detection.
- ⬜ Reversible apply (one-click rollback of the last import).
- ⬜ Mobile Admin-Lite re-sync trigger (UX-13 §5).

---

## 4. Billing

### 4.1 Surfaces today

| Surface | Path | Status |
|---|---|---|
| Parent billing | `app/parent/settings/billing/page.tsx` | 🟡 |
| School billing | `app/admin/school/billing/page.tsx` | 🟡 |
| Platform billing dashboards | `app/admin/platform/billing/{coupons,daily-batch,invoices,revenue}` | 🟡 (added in last refresh) |
| Parent billing BFF | `app/api/bff/billing/**` | 🟡 |
| Admin billing BFF | `app/api/bff/admin/billing/**` | 🟡 |

### 4.2 Per-role contract

**Parent.** One screen: plan · next charge date · payment method · invoices · cancel. No upsell on this screen. Cancel is two-click (confirm + acknowledge what happens to learners on cancel — read-only access for 30 days, then archive).

**School / District admin.** Seat-based view. Per-school: seat allocation, used, available, renewal date. Action: add seats (with cost preview), remove seats (only future-effective, never strands an active learner mid-lesson).

**Platform admin.** Four already-shipped pages — coupons, daily-batch (Stripe / Postmark reconciliation), invoices, revenue. Read-mostly; the write surfaces are limited to coupon creation and refund approval.

### 4.3 States

- **Empty**: trial / free tier → upgrade Card with clear pricing, never a dark pattern.
- **Loading**: skeleton receipt rows.
- **Error**: payment failures get a calm Card with a re-enter-card affordance; never expose Stripe error codes; admin platform surfaces show the full code for ops.
- **Failed payment grace**: 7-day grace banner across parent surfaces with the unblock CTA; no loss of access during grace.
- **Cancellation**: confirmation Card showing per-learner impact ("Ava and Ben will have read-only access until June 14").

### 4.4 Gaps

- ⬜ Seat-allocation UX on school billing (today: count only).
- ⬜ Coupon entry on parent billing.
- ⬜ Invoice download (PDF) — admin platform only today.
- ⬜ Refund flow on parent surface (today: contact support).
- ⬜ Mobile billing (Parent Mode tab — UX-13 §2).

---

## 5. Settings

### 5.1 Per-role groups

| Role | Surface root | Categories |
|---|---|---|
| Parent | `app/parent/settings/**` | Account · Billing · Accessibility · Language · Consent · Privacy · Notifications |
| Learner | `app/learner/settings/**` | Accessibility · Audio · Language · Avatar (planned) |
| Teacher | `app/teacher/settings/**` | Account · Classes · Notifications · Language |
| School admin | `app/admin/school/settings/**` | Admins · Branding · SSO |
| Platform admin | `app/admin/platform/settings/{api-keys,emails,webhooks}` | API keys · Email templates · Webhooks |

### 5.2 The settings page contract

Every settings page in AIVO follows the same shape — listed once here so we never re-invent it:

1. **One concern per page.** "Accessibility" is one page; "Audio" is a sibling, not a tab inside it.
2. **Autosave with a status pill.** No "Save" button. Each change posts; a polite pill in the corner reads "Saved" / "Saving…" / "Couldn't save" with `aria-live="polite"`.
3. **Per-field explainers.** A short caption under each label explains the consequence. No standalone "Learn more" links.
4. **Fieldsets and legends.** Grouped controls are `<fieldset>` with `<legend>` — UX-14 §4.
5. **No diagnostic terms in parent / learner copy.** "Functioning level" never appears as a setting (UX-04 §4.7).
6. **Reversible.** Destructive actions (delete account, revoke consent, disable rostering) require explicit confirmation + 14-day soft delete where applicable.

### 5.3 Cross-role concerns

| Concern | Lives at | Notes |
|---|---|---|
| Accessibility modes | per-role settings (text size, dyslexia font, reduced motion, high contrast) | UX-14 §3 |
| Audio prefs | per-learner under parent (TTS voice / rate / read-aloud default) | not in learner-self settings — parent owns |
| Language | per-role settings | UX-16 §6 |
| Consent | parent only (`/parent/consent`) — learners cannot change own consent | UX-03 §3 |
| Privacy / DSAR | parent (`/parent/privacy`) — data export, deletion | UX-03 §3.6 |
| Branding | school admin (`/admin/school/settings/branding`) | District-level branding planned |

### 5.4 Gaps

- ⬜ Mobile parity for accessibility, audio, language settings (UX-13 §6).
- ⬜ Learner avatar customization.
- ⬜ Teacher per-class notification rules (today: account-wide only).
- ⬜ District-level branding inheritance to schools.

---

## 6. Language (i18n)

### 6.1 Today's contract

`next-intl` with 10 supported locales (per `replit.md`), RTL support for Arabic. CI gate: `pnpm i18n:audit` enforces locale-file parity across web, marketing, and mobile.

### 6.2 Per-role surface

- **Parent / Teacher / Admin** — Settings → Language dropdown. Persists to user record; takes effect on next page render.
- **Learner** — same dropdown but the option list is filtered to the locales the parent has enabled for this learner (a parent can lock the learner to one or two languages even if the platform supports 10).
- **Anonymous** — language is sniffed from `Accept-Language` and persisted in a cookie; can be overridden from the footer language switcher on the marketing site.

### 6.3 States

- **Loading**: locale change does not reload — `next-intl` handles it via the App Router locale segment; show a polite "Switching language…" pill until the route refreshes.
- **Missing translation**: in production, fall back to `en-US` and emit a telemetry event (`i18n.fallback`) so the gap is logged. Never show the raw translation key to the user.
- **RTL flip**: Arabic toggles `dir="rtl"`; every layout primitive in `components/ui/*` must work in both directions — audit checklist in §6.5.

### 6.4 TTS locale

When a learner switches the app language, the TTS voice preference (in audio settings) does **not** automatically switch — keep them independent. Some learners use a different language for audio (e.g. English app, Spanish audio for a bilingual learner). Surface the relationship explicitly in audio settings.

### 6.5 RTL audit checklist

- [ ] All Tailwind logical properties used (`ms-*`, `me-*`, `ps-*`, `pe-*`) — not `ml-*`, `mr-*`, etc.
- [ ] All `flex-row` containers verified in `dir="rtl"`.
- [ ] All icons that imply direction (back/forward, undo/redo, next/prev) flip in RTL.
- [ ] Stage beat transitions audited for direction.
- [ ] All charts (admin / progress) read correctly in RTL.

### 6.6 Gaps

- ⬜ The §6.5 RTL audit — never done end-to-end.
- ⬜ Locale-aware date / number formatting wired everywhere (`Intl.DateTimeFormat`, `Intl.NumberFormat`) — partial today.
- ⬜ Curriculum content locale fan-out (only UI is localized today; AI-generated lesson content uses the parent's tutor-language preference, not necessarily the app locale).
- ⬜ Telemetry event `i18n.fallback` not yet emitted.

---

## 7. Deliverables

1. ✅ This contract.
2. ⬜ Teacher + Admin-Lite notification centers (§2.5).
3. ⬜ District rostering web surface + reversible apply (§3.5).
4. ⬜ Parent / school billing UX additions (§4.4).
5. ⬜ Mobile parity for accessibility / audio / language settings (§5.4).
6. ⬜ RTL audit + locale-aware formatting + `i18n.fallback` telemetry (§6.6).
7. ⬜ The settings page contract in §5.2 baked into a `<SettingsPage>` layout primitive that every settings route adopts.

---

## 8. Acceptance criteria

- [ ] Every notification has an `eventType`, a recipient role, a default channel set, and a quiet-hours flag.
- [ ] No safety-critical notification respects quiet hours.
- [ ] Every roster import has an explicit Apply gate; nothing applies silently.
- [ ] A partial-failure import always offers a CSV of failed rows.
- [ ] Parent billing never traps cancel behind a chat widget.
- [ ] Cancelling never strands an active lesson mid-run.
- [ ] No settings page contains a "Save" button — autosave + status pill only.
- [ ] No translation key string ever reaches the user; fallback to `en-US` is silent + logged.
- [ ] App language and TTS voice are independent settings, with the relationship surfaced explicitly.
- [ ] The §6.5 RTL audit passes for every shipped surface.

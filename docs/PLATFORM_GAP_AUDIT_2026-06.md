# Platform Gap Audit & Remediation Plan — June 2026

> Scope: end-to-end audit of stubs / placeholders / TODOs, user-journey
> completeness, web⇄mobile parity, tablet+phone formatting, unified login,
> and cross-device session continuity. Produced from a full sweep of
> `apps/`, `services/`, and `packages/`.

## Bottom line

AIVO is an unusually mature monorepo. It has CI gates that block demo data
in production (`scripts/no-demo-prod-scan.mjs`), missing surface contracts
(`scripts/surface-contract-scan.mjs`), and "Coming Soon" placeholders in the
web app (`apps/web-v2/scripts/route-audit.mjs`). There is essentially **one**
genuine TODO in application code and no `501`/`NotImplemented` handlers.

The real gaps are a small number of **code-level** incompletions (not just
config) concentrated in: web onboarding/signup, billing UI wiring,
child-safety (Speech Buddy), AI tutor responses, and a few mobile screens —
plus several **config-default** behaviors that production already flips.

## What's already solid

| Area                             | Verdict                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mobile tablet + phone formatting | Strong. Material-3 / iPadOS size classes (`apps/mobile/src/design/responsive.ts`), documented split-view multitasking matrix (`useWindowSizeClass.ts`), adaptive nav (phone bottom-tabs → tablet rail → drawer), content max-widths, used in ~60 files, regression-tested. `app.json`: `supportsTablet: true`, `resizeableActivity: true`. |
| Unified login — backend          | One Postgres `users`/`sessions` store, RS256 JWT, Argon2. Mobile and web (real mode) hit the same `identity-svc /api/auth/login`.                                                                                                                                                                                                          |
| Cross-device source of truth     | Single Postgres + JSONB brain state; prod enforces `postgres` persistence.                                                                                                                                                                                                                                                                 |
| Stub/TODO hygiene                | 1 genuine TODO in app code; the 108 STUB / 312 PLACEHOLDER raw hits are false positives (form `placeholder=`, scanner regex literals). `prod:check` passes.                                                                                                                                                                                |

## Gap inventory

Severity: **Blocker** (ships broken / unsafe), **Incomplete** (degraded or
partial), **Minor** (cleanup / config). "Config gap" = production already
flips the default; "Code gap" = a flag won't fix it.

### A. Unified login

1. **[Blocker · code] Web signup was fake.** `apps/web-v2/app/signup/page.tsx`
   redirected to `/login?signup=mock`; no `auth/register` call existed in
   web-v2. Mobile already registers. → **Fixed in this pass (see Changelog).**
2. **[Config] Web defaults to mock auth** (`AUTH_MODE=mock`). Prod refuses
   mock; dev/misconfig means web & mobile are not the same user.
3. **[Incomplete] PIN-login has no refresh session.** `services/identity-svc/.../auth.ts`
   mints a 2h JWT, inserts no `sessions` row → learner sessions hard-die at
   2h; mobile refresh-retry fails (no cookie). → **Fixed in this pass:
   pin-login now inserts a `sessions` row + sets the `refreshToken` cookie
   (role-based TTL) + surface cookie, mirroring login, so the learner
   session refreshes silently past 2h.**
4. **[By design — not a mobile gap] District admins & platform staff are
   web-only.** `/api/auth/login` 403s `DISTRICT_ADMIN`/staff and the mobile
   landing router (`apps/mobile/app/index.tsx`) has no home for them. The only
   district-side roles on mobile are **teacher** and **therapist**, which sign
   in through the normal consumer login (they are not bounced). District-admin
   and internal-staff consoles live on the web admin/district surfaces.

### B. Cross-device session continuity

5. **[Config] Web defaults to in-memory store** (`AIVO_PERSISTENCE=memory`,
   `AIVO_USE_SERVICE_STACK=false`). Mobile progress lands in Postgres; web
   won't show it until flags flip (prod enforces).
6. **[Incomplete] No real-time sync / polling.** Continuity is
   "shared-DB-read-on-next-load" only — no websocket/SSE between clients.

### C. Web user-journey completeness

7. **[Blocker · code] Onboarding wizard was inert** — pure `<Link>`
   navigation; inputs discarded; `onboarding/signin` submit did nothing. →
   **Partially fixed in this pass** (signup, signin, and learner creation
   now persist; intermediate informational steps remain navigation).
8. **[Blocker · code] Billing UI not wired to `billing-svc`.** `billing-svc`
   is fully real (Stripe `stripe.ts`, `webhooks.ts`, reconciliation,
   entitlements — proven by `e2e/.../stripe-purchase-to-entitlement.spec.ts`),
   but web `app/api/bff/parent/subscription/route.ts` only mutates the
   in-memory store. No Checkout session is created; the subscribe button
   charges no one. → **Fixed in this pass (see Changelog).**
9. **[Incomplete] Messages/inbox unbuilt.** `app/messages/page.tsx` is a
   role-aware empty state. → **Fixed in this pass: a real threaded inbox
   (DB + comms-svc + web + mobile). See Changelog.**
10. **[Config-ish] AI tutor/lesson canned by default.** `lib/homework/tutor.ts`
    (wired into 3 BFF routes) and `lib/learner/lesson-plan.ts` return
    deterministic content; real Anthropic provider exists but is env-gated.

### D. Mobile stubs & web↔mobile disparities

11. **[Incomplete] Mobile baseline uses mock questions.**
    `apps/mobile/app/(learner)/baseline/run.tsx` hardcodes a 5-item `SAMPLE`
    array; web baseline is real adaptive IRT. (The demo-scanner misses
    `SAMPLE`.) → **Fixed in this pass: the runner fetches the learner's real
    baseline from assessment-svc (`/api/assessments/learner/baseline/:id`,
    which itself serves an AI set or a curated fallback bank) with
    loading/error/not-ready states; the hardcoded `SAMPLE` is removed.**
12. **[Incomplete] Co-Learning stub** — `(parent)/colearn/[childId].tsx` dead
    CTA `onAction={() => {}}`. → **Fixed: shows the child's current/recent
    session (live-polled `LearnerLiveSessionCard`) instead of a dead CTA.**
13. **[Incomplete] Live parent session viewing stub** —
    `(parent)/session/[childId].tsx` empty state only. → **Fixed: a real
    co-view of the learner's current session — `useLearnerLiveSessions`
    (learning-svc `GET /api/learning/sessions`, polled 6s) renders an
    "Active now" / last-session card.**
14. **[Incomplete] Therapist "Add goal" unwired** —
    `(therapist)/client/[id]/goals.tsx:61` dead CTA. → **Fixed: family-svc
    `POST /api/family/therapy-goals` (auth + learner-access) + a mobile
    add-goal modal (`useCreateTherapyGoal`); also fixed a latent
    `g.progress`→`g.progressPct` render bug.**
15. **[Incomplete] Offline queue is in-memory** (`apps/mobile/hooks/useOffline.ts`)
    — module array, not the spec'd persistent `expo-sqlite` + `idempotencyKey`
    queue; lost on restart; replayed requests carry no auth header. → **Fixed
    in this pass: persistent (AsyncStorage), idempotency-keyed, authed-replay
    (`apiFetch`), 7-day-stale-dropping queue in `lib/offline-queue.ts` (8
    tests).**
16. **[Minor] Hardcoded Google OAuth client ID** — `(auth)/login.tsx:29`.

### E. Child-safety / AI (high stakes)

17. **[Blocker] Speech Buddy Layer-3 safety judge is a keyword stub.**
    `services/ai-svc/src/ai_svc/speech_buddy/safety.py:207` `_default_judge`
    is the production default (`orchestrator_impl.py:124`); real LLM
    moderation is never wired. → **Fixed in this pass (see Changelog).**
18. **[Blocker] Speech Buddy consent store is env-var-only.**
    `services/family-svc/src/routes/speech-buddy-consent.ts` reads
    `SPEECH_BUDDY_DEV_CONSENTS`; no DB store or parent UI. In prod with no
    env var, every consent check fails. → **Fixed in this pass — DB store +
    family-svc API + web & mobile parent UI (see Changelog).**

### F. Lower severity / cleanup

19. **[Minor] `x-aivo-active-role` never enforced server-side.** Mobile sends
    it; no service validates it (documented Sprint-09 follow-up never landed).
    Hint-only, so low risk — but the documented spoof protection is absent.
    → **Fixed — shared helper + family-svc enforcement, then adopted across
    every JWT service. The remaining JWT services (assessment-svc, comms-svc,
    admin-svc) now register the shared `registerActiveRoleHook` global hook
    (see Changelog), so the header is enforced platform-wide.**
20. **[Minor] Unified mobile shell migration stalled.**
    `MOBILE_UNIFIED_APP=false`, no `(app)` shell; legacy per-role shells
    remain (role switch ⇒ re-login). → \*\*Progressed: the contract's
    `lib/api.ts` active-role propagation now ships — mobile sends
    `x-aivo-active-role` on every authenticated request (sourced from the
    signed-in user via `lib/active-role.ts`, kept in sync by `useAuth`),
    completing the loop with the #19 server-side validation. The remaining
    work (the `(app)` shell, role chooser/switcher, screen migration,
    flag flip) is blocked on multi-role tokens (today's JWT is single-role)
    - on-device nav testing — see note below.\*\*

    **Multi-role foundation (this pass):** the data model now exists — a
    `user_roles` table (migration `0056`), `availableRoles` in the JWT
    (`@aivo/security` `JWTPayload` + identity-svc login aggregates
    `users.role ∪ user_roles`), and the consumer services
    (`family/engagement/billing/learning/tutor`) validate the active-role
    header against the full `availableRoles` set. The mobile client decodes
    `availableRoles` onto `useAuth().user`. What remains is purely the
    `(app)` shell UI + screen migration (needs device testing) and the
    write-path now exists too: **identity-svc admin endpoints**
    (`GET/POST/DELETE /api/admin/users/:userId/roles`) let a
    SCHOOL/DISTRICT/PLATFORM admin grant/revoke a user's additional roles
    (tenant-scoped, hash-chained `admin_audit_log` ROLE_GRANTED/REVOKED rows).
    So a user can now genuinely hold multiple roles end-to-end. The last
    remaining pieces are the `(app)` shell UI (needs device testing) and a
    web admin screen to drive the grant/revoke API and a
    web admin screen to drive the grant/revoke API. **Web admin UI added
    this pass:** an "Additional roles" card on the platform-admin user
    detail page (`/admin/platform/users/[id]`) grants/revokes roles via a
    dual-path BFF (`/api/bff/admin/users/[userId]/roles` → identity-svc when
    enabled + a real admin token, else an in-memory store), with web↔wire
    role mapping. So the only remaining piece for #20 is the `(app)` shell
    UI itself (which needs on-device navigation testing).

21. **[Minor] Parity matrix drift.** Strict `mobile:parity` fails:
    `/messages`, `/notifications` untracked. The "100% parity" doc only checks
    file existence, not functionality. → **Fixed: both routes tracked;
    strict `mobile:parity` passes (115 routes, no drift); `docs/mobile-parity.md`
    regenerated.**
22. **[Incomplete] comms-svc SMS channel** unimplemented (`sms: "not_available"`).
23. **[Incomplete] AAC AssistiveWare highlight** no-op
    (`packages/aac-bridge/src/adapters/AssistiveWareAdapter.ts:58`).
24. **[Incomplete] Web migration runner** skips `iep_documents`/`lesson_runs`
    (`apps/web-v2/lib/db/repos.ts:5253`).
25. **[Minor] Dev/demo routes ship in tree** — web `design-system`,
    `surface-preview`, `lesson-player-fixture`; mobile `(shell-demo)`. Mascot
    art is placeholder SVGs (`packages/brand`). → **Partially fixed: web
    middleware now 404s `/design-system`, `/surface-preview`, and the
    lesson-player fixtures in production. Mobile `(shell-demo)` + mascot art
    remain.**

## Changelog — i18n pass (web copy)

Extracted the English-only strings added across the signup/onboarding,
billing, and Speech-Buddy-consent surfaces into the next-intl message
catalogs, across all 10 locales (identical English values are allowed by the
coverage gate for non-`learner.*` namespaces; translators fill them in
later).

- `apps/web-v2/lib/i18n/messages/*.json` (10) — added
  `auth.signup.errors.*`, `onboarding.{signup,signin}.errors.*`,
  `onboarding.learner_new.error_first_name`, `parent.billing.checkout.*`,
  `parent.learner_settings.speech_buddy_*`, and the `parent.speech_buddy.*`
  consent namespace.
- The signup / onboarding-signup / onboarding-signin / onboarding-learner-new
  / billing / learner-settings pages and the `SpeechBuddyConsentCard` now
  read those keys via `t()` instead of inline English.

Verified: i18n coverage + direction tests pass (27 tests); web-v2 typecheck

- eslint clean; `next build` green. The mobile strings already use the
  `t(key, defaultValue)` pattern, so they render translated-or-English without
  catalog churn.

## Changelog — unified inbox / messaging (#9)

Replaced the role-aware empty-state `/messages` page with a real threaded
inbox across the stack (dual-path: comms-svc when enabled, in-memory store
in dev/mock).

- **DB** (`packages/db`) — `message_threads`, `message_thread_participants`
  (unique per thread/user, `last_read_at` for unread), `messages` + migration
  `0055`.
- **comms-svc** (`routes/messages.ts`) — `GET/POST /api/comms/threads`,
  `GET/POST /api/comms/threads/:id/messages`, `POST .../read`;
  JWT-authenticated, tenant-scoped, participant-checked, with
  `x-aivo-active-role` enforcement.
- **Web** — `lib/db/messages-store.ts` (seeded dev store),
  `lib/bff/comms-svc.ts`, BFF routes under `/api/bff/messages/*`, and a
  two-pane `MessagesInbox` (thread list + thread view + reply) on the
  `/messages` page.
- **Mobile** — `components/messages/MessagesInbox.tsx` (master/detail list →
  thread → reply) swapped into the `allow` branch of `app/messages.tsx`,
  calling comms-svc via `apiFetch(API.COMMS, ...)`.
- **Parity** — `/messages` + `/notifications` added to the parity matrix;
  strict `mobile:parity` passes (115 routes); `docs/mobile-parity.md`
  regenerated.

Scope note: starting a _new_ thread needs a team-member recipient picker
(cross-service directory), so the first slice covers list → open → reply and
seeds a demo thread in dev; thread creation is a follow-up.

**Live updates (this pass):** both the web and mobile inbox now poll while
foregrounded — the thread list every 12s and the open conversation every 6s
(visibility/AppState-aware) — so a reply from the other side appears without
a manual reload. This is a robust, dual-path alternative to a push stream;
a WebSocket/SSE transport remains a future optimization (its streaming layer
needs a live stack to verify).

Verified: `@aivo/db` + `@aivo/comms-svc` build clean; web-v2 typecheck +
eslint clean; mobile `tsc` (0 errors) + eslint clean; `next build` green.

## Remediation plan (phased)

**Phase 0 — Config hardening.** Make staging mirror prod (`AUTH_MODE=custom`,
`AIVO_PERSISTENCE=postgres`, `AIVO_USE_SERVICE_STACK=true`, AI keys); fail the
mobile build if `EXPO_PUBLIC_API_URL` / Google client ID are unset. Addresses
#2, #5, #10, #16.

**Phase 1 — Blockers.** Web signup (#1 ✅), onboarding wizard (#7 ✅ partial),
billing→billing-svc Checkout (#8), Speech Buddy safety judge (#17) + consent
store (#18), active-role enforcement (#19 ✅).

**Phase 2 — Parity & continuity.** Mobile baseline → assessment-svc IRT (#11),
persistent authed offline queue (#15), PIN refresh session (#3), messages/inbox
(#9), refresh parity matrix (#21), lightweight real-time sync for active learner
state (#6). (#4 is by design — district admins/staff are web-only; mobile's
district-side roles are teacher + therapist, which already log in.)

**Phase 3 — Incomplete features.** Tutor LLM (#10), co-learn (#12), live
session viewing (#13), therapist add-goal (#14), comms SMS (#22), AAC
highlight (#23), web migration runner (#24).

**Phase 4 — Cleanup.** Exclude dev/demo routes from prod (#25), finish unified
mobile shell (#20), final mascot art.

## Changelog — this pass (Phase 1: web signup + onboarding)

Converted the consumer self-service signup + onboarding from inert mocks to
real, session-establishing flows:

- `apps/web-v2/lib/auth/identity-client.ts` — added `identityRegister()`
  (POST `/api/auth/register`, PARENT-only), mirroring `identityLogin`.
- `apps/web-v2/lib/auth/auth-actions.ts` (new) — `registerAction` and
  `onboardingSignInAction` server actions: real identity-svc calls, web-v2
  session cookies, open-redirect-safe `next`/`errorReturn`, and a preserved
  `AUTH_MODE=mock` dev affordance.
- `apps/web-v2/app/signup/page.tsx` — posts to `registerAction` (was a
  mock `setTimeout` redirect); error banner.
- `apps/web-v2/app/onboarding/signup/page.tsx` — self-serve branch posts to
  `registerAction` (was `<Link>`-only); invite branch unchanged.
- `apps/web-v2/app/onboarding/signin/page.tsx` — wraps the (previously
  form-less, inert) inputs in a form posting to `onboardingSignInAction`;
  delegates MFA/staff redirects to the canonical `/login` flow.
- `apps/web-v2/app/onboarding/learner/new/{page,actions}.tsx` — creates a
  real learner via `createLearner` (was a dead `<Link>`), terminating the
  funnel on the real learner detail page.

Verified: web-v2 `typecheck` clean, `eslint --max-warnings=0` clean on all
changed files, `prod:check` passes. No unit/e2e tests target these surfaces.

Remaining in onboarding (follow-ups): intermediate informational steps
(role/terms/privacy/consent) are still pure navigation; the field-level error
copy is English-only pending an i18n pass.

## Changelog — Phase 1: onboarding consent persistence (#7, slice 1)

Closed the consent-step half of gap #7 ("onboarding wizard") by making the
review step actually persist what the parent selects, instead of discarding
all four toggles on `<Link>` navigation. No new backend — the route reuses the
existing `POST /api/bff/consent` and its `consent.accept` audit emission.

- `apps/web-v2/app/onboarding/consent/page.tsx` — replaced the `next/link`
  Continue with a submit handler that POSTs `/api/bff/consent` per accepted
  bucket, mapping the four UI toggles onto the canonical `CONSENT_TYPES`:
  parent → `parent_account_terms` + `child_data_collection`, school →
  `school_roster_import`, AI → `ai_personalization`, marketing →
  `marketing_opt_in`. Preserves the parent-required gate, surfaces an
  i18n'd inline error on failure (no navigation), and only navigates to
  `/onboarding/permissions` after every record is persisted.
- `apps/web-v2/lib/i18n/messages/{ar,de,en,es,fr,hi,ja,ko,pt,zh}.json` —
  added `onboarding.consent.saving` and `onboarding.consent.save_error` in
  all 10 supported locales (matching the prior onboarding i18n pass).

Slices 2–3 of the plan (permissions notification preference; learner-scoped
IEP-upload persistence) and Slice 4 (PIN / parent-setup / parent-verify /
child-approval — all needing new backends) are out of scope for this PR.

Verified: `corepack pnpm --filter @aivo/web-v2 typecheck` clean,
`eslint --max-warnings=0` clean on the changed file, and
`corepack pnpm --filter @aivo/web-v2 build` succeeds.

## Changelog — Phase 1: onboarding permissions + IEP persistence (#7, slices 2–3)

Continued closing gap #7 by making the two remaining input-bearing onboarding
steps persist instead of discarding their state. No new backends — both reuse
existing, tested BFF endpoints.

Slice 2 — permissions step:

- `apps/web-v2/app/onboarding/permissions/page.tsx` — replaced the Continue
  `<Link>` with a submit that persists the Notifications toggle via
  `PATCH /api/bff/notification-preferences`, flipping the email channel for the
  parent-facing `parent_progress_summary` and `safety_review_required` types
  (the "weekly digests + safety/approval messages" the row describes). The mic
  and camera toggles are documented in-code as browser-level device-capability
  prompts (the real grant is the browser's own permission dialog at point of
  use) and are intentionally not persisted, so the step is honest rather than
  silently dropping server state it never had.
- Adds `onboarding.permissions.saving` / `save_error` in all 10 locales.

Slice 3 — IEP-upload step (depends on a `learnerId`):

- `apps/web-v2/app/onboarding/iep-upload/page.tsx` — the step now persists.
  IEP documents are learner-scoped, so the page resolves a `learnerId` from
  the `?learnerId=` query string and, when absent, gates behind learner
  selection by fetching `GET /api/bff/learners` (auto-selecting a sole learner,
  offering a picker for several, and pointing the parent at
  `/onboarding/learner/new` when none exist). On submit with a file it records
  explicit `iep_document_storage` consent via
  `POST /api/bff/learners/[learnerId]/consent` and then POSTs the multipart
  file to `POST /api/bff/learners/[learnerId]/iep-upload`; the skip path calls
  `POST …/iep-upload/skip` so a deliberate "no IEP" is also recorded. Errors
  surface inline without navigating.
- Adds `onboarding.iep_upload.{saving,save_error,consent_required,
select_learner_label,select_learner_placeholder,no_learner_title,
no_learner_body,no_learner_cta}` in all 10 locales.

Slice 4 (learner PIN-set, household / co-parent invites, real phone/SMS
verification — overlapping SMS gap #22, and child-approval persistence) remains
separate feature work needing new backends, and is out of scope here.

Verified: `corepack pnpm --filter @aivo/web-v2 typecheck` clean and
`eslint --max-warnings=0` clean on the changed files. (`pnpm --filter
@aivo/web-v2 build` only fails in the sandbox because Google Fonts is
unreachable — unrelated to these changes.)

## Changelog — Phase 1: onboarding child-approval persistence (#7, slice 4)

Closed the child-approval half of slice 4 of gap #7 by making the final
parent-approval gate actually persist instead of discarding its toggles on
`<Link>` navigation. No new backend — the step reuses the existing, tested
per-learner consent endpoint (the same `POST /api/bff/learners/[learnerId]/consent`
slice 3 used for IEP storage).

- `apps/web-v2/app/onboarding/child-approval/page.tsx` — the "Approve and
  finish" gate now persists. Approval is learner-scoped, so the page resolves a
  `learnerId` from the `?learnerId=` query string and, when absent, gates behind
  learner selection by fetching `GET /api/bff/learners` (auto-selecting a sole
  learner, offering a picker for several, and pointing the parent at
  `/onboarding/learner/new` when none exist) — the same resolution pattern as the
  slice 3 IEP step. On Approve it records `child_data_collection` (always — the
  core consent that lifts the profile out of its holding state so the child can
  sign in), plus `teacher_access` when "Messages with teachers" is on and
  `ai_personalization` when "AI tutor" is on. Records are written in sequence so a
  mid-way failure surfaces an inline error without navigating. Voice mode stays an
  honest browser-level device-capability (the mic grant is the browser's own
  prompt at point of use) and is intentionally not persisted as a server consent,
  matching the slice 2 mic/camera treatment.
- `apps/web-v2/lib/i18n/messages/{ar,de,en,es,fr,hi,ja,ko,pt,zh}.json` — added
  `onboarding.child_approval.{saving,save_error,select_learner_label,
select_learner_placeholder,no_learner_title,no_learner_body,no_learner_cta}`
  in all 10 supported locales.

The remaining slice 4 sub-parts — learner PIN-set, household / co-parent invites,
and real phone/SMS verification (overlapping SMS gap #22) — still need new
backends and remain separate follow-up work, out of scope for this change.

Verified: `corepack pnpm --filter @aivo/web-v2 typecheck` clean and
`eslint --max-warnings=0` clean on the changed file. (`pnpm --filter
@aivo/web-v2 build` only fails in the sandbox because Google Fonts is
unreachable — unrelated to these changes.)

## Changelog — Phase 1: onboarding learner PIN-set persistence (#7, slice 4)

Closed the learner-PIN half of slice 4 of gap #7 by making the `/onboarding/pin`
step actually set the learner's PIN instead of discarding the entered digits on
`<Link>` navigation. The PIN is the value the mobile learner `pin-login` flow
verifies (`apps/mobile/hooks/useAuth.ts` → identity-svc `POST /api/auth/pin-login`
against `users.pin`), so the step now writes through to that same field.

- `apps/web-v2/app/api/bff/learners/[learnerId]/pin/route.ts` (new) — dual-path
  (ADR 0009) BFF route. `POST` validates a 4–6 digit PIN, enforces a parent
  session + learner-ownership scope, then: when identity-svc is enabled and a
  real access token is present, sets the PIN via
  `PUT /api/users/learners/:learnerId` on identity-svc (which re-checks parent
  ownership); otherwise persists to an in-memory dev store. `GET` returns only
  `{ hasPin, pinSetAt }` — never the secret. Both verbs audit `learner.pin.set`.
- `apps/web-v2/lib/bff/identity-learners.ts` (new) — server-only client for the
  identity-svc learner-PIN mutation, with the standard service flag/bearer/timeout
  handling.
- `apps/web-v2/lib/db/learner-pin-store.ts` (new) — the dev/mock fallback store.
  Even in this throwaway store the PIN is salted + scrypt-hashed and only
  `hasPin`/`pinSetAt` are ever exposed; a constant-time `verifyStoredLearnerPin`
  is provided for a future learner-unlock surface and tests.
- `apps/web-v2/app/onboarding/pin/page.tsx` — the PIN step now persists. A PIN is
  learner-scoped, so the page resolves a `learnerId` from `?learnerId=` and, when
  absent, gates behind learner selection via `GET /api/bff/learners` (auto-select
  sole learner, picker for several, `/onboarding/learner/new` CTA when none) — the
  same resolution pattern as the slice 3 IEP step. On Save it `POST`s the PIN and
  advances on success, surfacing an inline error without navigating on failure.
  Skip still advances without setting a PIN.
- `apps/web-v2/lib/i18n/messages/{ar,de,en,es,fr,hi,ja,ko,pt,zh}.json` — added
  `onboarding.pin.{saving,save_error,select_learner_label,
select_learner_placeholder,no_learner_title,no_learner_body,no_learner_cta}`
  in all 10 supported locales.

The remaining slice 4 sub-parts — household / co-parent invites and real
phone/SMS verification (overlapping SMS gap #22) — still need IA/backends work
and remain separate follow-up, out of scope for this change.

Verified: `corepack pnpm --filter @aivo/web-v2 typecheck` clean and
`eslint --max-warnings=0` clean on the changed files. (`pnpm --filter
@aivo/web-v2 build` only fails in the sandbox because Google Fonts is
unreachable — unrelated to these changes.)

## Changelog — Phase 1: onboarding household + phone-verify persistence (#7, slice 4)

Closed the final two slice 4 sub-parts of gap #7 — household / co-parent
invites and real phone/SMS verification (overlapping SMS gap #22). Both
onboarding steps used to discard their input on `<Link>` navigation; they now
persist through new dual-path (ADR 0009) BFF routes.

- `apps/web-v2/app/api/bff/onboarding/parent-verify/route.ts` (new) — issues +
  verifies a one-time phone code. `POST` validates the number, mints a hashed
  6-digit code in the new `parent-phone-store`, and delivers it over SMS via
  comms-svc (`providers/sms-router` → Twilio when configured) when comms-svc is
  enabled + a real token is present, else the dev path issues the code without a
  real text. `PUT` verifies the typed code (constant-time, single-use, 10-min
  expiry, 5-attempt cap). `GET` returns `{ phoneVerified, pendingPhone }` — the
  code and full number are never returned. Audits `parent.phone.verify.requested`
  / `parent.phone.verified` / `parent.phone.verify.failed`.
- `apps/web-v2/lib/db/parent-phone-store.ts` (new) — the dev/mock OTP backend.
  The code is salted + scrypt-hashed at rest and only handed once to the BFF for
  delivery; status output masks all but the last 4 digits.
- `apps/web-v2/app/onboarding/parent-verify/page.tsx` — "Send code" now POSTs the
  phone and "Verify and continue" PUTs the code; only a server-confirmed match
  advances to `/onboarding/consent`. Inline errors, no silent navigation.
- `apps/web-v2/app/api/bff/onboarding/household/route.ts` (new) — `POST` saves the
  household display name and, when a co-parent email is supplied, records a
  household-scoped invite, emailing it via comms-svc (`collaboration_invite`
  template) when wired, else recording it in the dev store. `GET` returns the
  saved name + pending invites. Audits `household.updated` /
  `household.coparent.invited`.
- `apps/web-v2/lib/db/household-store.ts` (new) — the dev/mock household +
  co-parent-invite backend (household-scoped, since no learner exists yet at
  parent-setup), with email validation and pending-invite de-duplication.
- `apps/web-v2/lib/bff/comms-svc.ts` — added `sendSmsCodeSvc` (SMS, `mfa_code`)
  and `sendCoParentInviteSvc` (email, `collaboration_invite`) helpers fronting
  comms-svc `POST /api/comms/send`.
- `apps/web-v2/app/onboarding/parent-setup/page.tsx` — Continue now POSTs the
  household name + co-parent email before advancing to `/onboarding/learner/new`.
- `apps/web-v2/lib/i18n/messages/{ar,de,en,es,fr,hi,ja,ko,pt,zh}.json` — added
  `onboarding.parent_verify.{sending,verifying,send_error,verify_error}` and
  `onboarding.parent_setup.{saving,save_error,coparent_invite_error,
coparent_invited}` in all 10 locales.
- `apps/web-v2/lib/db/__tests__/{parent-phone-store,household-store}.test.ts`
  (new) — cover the challenge lifecycle (issue/verify/expiry/attempt-cap/
  never-echo) and the household name + invite lifecycle.

With this, every input-bearing onboarding step in gap #7 persists; the slice 4
follow-up list is now empty.

Verified: `corepack pnpm --filter @aivo/web-v2 typecheck` clean,
`eslint --max-warnings=0` clean on the changed files, and the new store tests
pass (`vitest run`). (`pnpm --filter @aivo/web-v2 build` only fails in the
sandbox because Google Fonts is unreachable — unrelated to these changes.)

## Changelog — Phase 1: billing → billing-svc (#8)

Wired the web parent billing surface to the real, Stripe-backed
`billing-svc` (previously the subscribe/cancel buttons only mutated the
in-memory store, so no payment was ever taken). The integration is a thin
client over billing-svc's own vocabulary (`single`/`family`) — billing-svc
owns the Stripe Price IDs via its env, so the web never maps a Stripe price.

- `apps/web-v2/lib/env.ts` — `BILLING_SVC_URL` (default `:3009`),
  `BILLING_SVC_SERVICE_TOKEN`, and `AIVO_USE_BILLING_SVC` (per-service
  override of `AIVO_USE_SERVICE_STACK`).
- `apps/web-v2/lib/bff/billing-svc.ts` (new) — server-only client:
  `loadParentBillingOverview` (catalog + subscription + invoices, mapped to
  the page view-model), `createParentCheckout` (Stripe Checkout), and
  `cancelParentSubscription`. Forwards the user's `aivo_access_token` as the
  bearer (billing-svc `requireAuth` verifies the same RS256 JWT) and degrades
  to the store on a transient failure.
- `apps/web-v2/app/api/bff/parent/subscription/route.ts` — POST creates a
  real Checkout session (returns `checkoutUrl`) and DELETE cancels via
  billing-svc when enabled + a real token is present; otherwise the existing
  in-memory store simulation is used (dev/demo, `AUTH_MODE=mock`).
- `apps/web-v2/app/parent/settings/billing/page.tsx` — reads the dual-path
  overview and shows a Stripe return banner (`?checkout=success|cancelled`).
- `apps/web-v2/app/parent/settings/billing/subscribe-form.tsx` — redirects
  the browser to the hosted Stripe Checkout URL when one is returned.

Gating: real billing is OFF by default (`AIVO_USE_BILLING_SVC` unset →
falls back to `AIVO_USE_SERVICE_STACK=false`), so existing dev/demo, mock
auth, and the e2e suite are unchanged; production enables the service stack.
After a real Checkout, the `subscriptions` row is created by the Stripe
webhook (already real and e2e-proven), which then drives entitlements.

Verified: web-v2 `typecheck` clean, `eslint --max-warnings=0` clean on
changed files, `prod:check` passes. Banner copy is English-only pending an
i18n pass.

## Changelog — Phase 1: Speech Buddy real LLM safety judge (#17)

The child-facing Speech Buddy's Layer-3 safety judge was a hardcoded
keyword stub (`_default_judge`) that only caught a few literal phrases and
was the production default — the real LLM moderation was never wired.

Added a real LLM judge without touching the synchronous filter contract or
its red-team tests (the deterministic regex + keyword layers remain the
always-on guarantee):

- `services/ai-svc/src/ai_svc/speech_buddy/llm_judge.py` (new) —
  `llm_judge_classify` calls the existing `llm_gateway.generate_completion`
  (Haiku-first chain, JSON output, temp 0) with a conservative child-safety
  classification prompt over the canonical categories. It **fails open**
  (returns `None`) on any model/parse error and applies **no per-tenant
  budget cap** (safety must never be denied for spend). `get_default_async_judge`
  enables it only when `SPEECH_BUDDY_JUDGE_PROVIDER=llm`.
- `services/ai-svc/src/ai_svc/speech_buddy/safety.py` — added an optional
  `async_judge` and a new `async check_async()` that runs the same
  deterministic layers 1+2, then awaits the real LLM judge as layer 3 (or
  falls back to the sync stub when no async judge is configured). The sync
  `check()` and all its tests are unchanged.
- `services/ai-svc/src/ai_svc/speech_buddy/orchestrator_impl.py` — the
  default filter is now built with `get_default_async_judge()`, and the two
  child-input / buddy-output checks call `await check_async(...)`.
- `services/ai-svc/tests/test_speech_buddy_llm_judge.py` (new) — 13 tests
  covering routing, regex short-circuit, fail-open, gateway JSON parsing,
  unknown-category rejection, and env gating (faked gateway, no `litellm`
  dependency).

Gating: the LLM judge is OFF by default (`SPEECH_BUDDY_JUDGE_PROVIDER`
unset → deterministic stub), so the offline red-team suite and all existing
speech_buddy tests pass unchanged (38 green locally). Production sets
`SPEECH_BUDDY_JUDGE_PROVIDER=llm`.

## Changelog — Phase 1: Speech Buddy consent store backend (#18)

Replaced the env-allow-list consent stub with a real, DB-backed consent
store + parent grant/revoke API. The internal verify endpoint (called by
tutor-svc on every Speech Buddy session) now reads real grants, so the
feature is no longer dead in production.

- `packages/db/src/schema/speech_buddy.ts` (new) + migration
  `0054_speech_buddy_consents.sql` + journal entry — the
  `speech_buddy_consents` table (tenant, learner, parent, age band, scope,
  granted/revoked timestamps; active = `revoked_at IS NULL`).
- `services/family-svc/src/routes/speech-buddy-consent.ts` — rewritten:
  - `GET /api/family/speech-buddy/consent/:learnerId` — parent reads status.
  - `POST /api/family/speech-buddy/consent/:learnerId` — parent grants
    (supersedes prior active grant; retains history).
  - `POST /api/family/speech-buddy/consent/:learnerId/revoke` — parent
    revokes. All three use JWT auth + `verifyParentOwnership`.
  - Internal verify now reads the DB first; the `SPEECH_BUDDY_DEV_CONSENTS`
    env list remains a dev/test fallback only (so tutor-svc's offline tests
    keep passing). The verify response shape is unchanged.
- `services/family-svc/src/routes/schemas.ts` — schemas for the three new
  parent endpoints.

Verified: `@aivo/db` and `@aivo/family-svc` build clean (`tsc`). The verify
contract is byte-compatible, so tutor-svc is unaffected.

## Changelog — Phase 1: `x-aivo-active-role` enforcement (#19)

The unified mobile app sends `x-aivo-active-role` on every authenticated
request, but no service validated it — the documented spoof protection
("Sprint 09 follow-up") never landed.

- `packages/security/src/active-role.ts` (new) — `checkActiveRole(grantedRole,
header, { availableRoles? })` plus `ACTIVE_ROLE_HEADER`, `FORBIDDEN_ROLE_CODE`,
  and `ACTIVE_ROLE_SPOOFING_EVENT` constants. Header absent → no-op; header
  matching a granted role → ok; otherwise a `FORBIDDEN_ROLE` spoof result.
  Tokens carry a single `role` today, so the granted set defaults to
  `[role]` (a normal single-role caller always passes); it widens
  automatically when `availableRoles` is supplied for future multi-role
  tokens. 8 unit tests (53 green in the package).
- `services/family-svc/src/auth.ts` — `authenticateRequest` now runs the
  check after JWT verify and, on a spoof, audit-logs
  `auth.active_role.spoofing` and returns `403 FORBIDDEN_ROLE`.

Safe by construction: real single-role users send their own role, so the
check never false-rejects; it only catches a client claiming a role its
token doesn't grant.

**Rollout:** the helper is now wired into the central auth path of the
consumer-facing services the mobile app hits — `family-svc`,
`engagement-svc`, `billing-svc` (`requireAuth`), and the shared
`registerAuthHook` in `learning-svc` and `tutor-svc` (user tokens only;
service-token calls are unaffected). The remaining JWT services
(`assessment-svc`, `comms-svc`, `admin-svc`) follow the same one-line
pattern.

Verified: `@aivo/security` builds + 53 tests pass; `family-svc`,
`engagement-svc`, `billing-svc`, `learning-svc`, `tutor-svc` build clean.

### #18 parent UI (web + mobile)

Wired the parent grant/revoke surface on both platforms, dual-path like
billing (real family-svc when enabled + a real token; in-memory store for
dev/mock):

- `apps/web-v2/lib/env.ts` — `FAMILY_SVC_URL` (`:3007`),
  `FAMILY_SVC_SERVICE_TOKEN`, `AIVO_USE_FAMILY_SVC`.
- `apps/web-v2/lib/bff/family-svc.ts` (new) — server-only client
  (`getSpeechBuddyConsent` / `grant` / `revoke`) forwarding the parent's
  `aivo_access_token` bearer.
- `apps/web-v2/lib/db/speech-buddy-consent-store.ts` (new) — in-memory
  dev/mock fallback store.
- `apps/web-v2/app/api/bff/parent/learners/[learnerId]/speech-buddy-consent/route.ts`
  (new) — GET/POST/DELETE; `requireSession` + parent role +
  `parentCanAccessLearner`; dual-path family-svc vs store; audits
  `speech_buddy.consent.granted` / `.revoked`.
- `apps/web-v2/app/parent/learners/[learnerId]/speech-buddy-consent-card.tsx`
  (new) + a "Speech Buddy" section on the parent learner settings page —
  status, age-band picker, enable / withdraw.
- `apps/mobile/components/parent/SpeechBuddyConsentCard.tsx` (new) + the
  parent `settings-learner/[childId]` screen — calls family-svc directly via
  the authenticated `apiFetch(API.FAMILY, ...)`.

Verified: web-v2 `typecheck` + `eslint --max-warnings=0` clean on changed
files; mobile `tsc` (0 errors) + `eslint` clean. With #18's backend, this
fully closes the Speech Buddy consent blocker. Consent copy is English-only
pending an i18n pass.

## Changelog — Phase 1: `x-aivo-active-role` enforcement everywhere (#19)

Closed the remaining JWT services so the active-role spoof protection is now
enforced platform-wide (previously only `family-svc`, `engagement-svc`,
`billing-svc`, `learning-svc`, and `tutor-svc` validated the header).

- `packages/security/src/active-role.ts` — added `registerActiveRoleHook(app)`,
  a framework-light Fastify `onRequest` hook that enforces the existing
  `checkActiveRole` contract globally. It only does work when the
  `x-aivo-active-role` header is present (the unified mobile app sends it on
  every authenticated request; web + internal service-token callers do not),
  reads the bearer token from the `Authorization` header or `access_token`
  cookie, and on a spoofed header audit-logs `auth.active_role.spoofing` and
  returns `403 FORBIDDEN_ROLE`. Header absent, no user token, or an invalid
  token ⇒ no-op (the route's own auth still applies — the hook never adds a
  new authentication requirement, it only rejects spoofed role hints).
  Exported from `@aivo/security`.
- `services/assessment-svc/src/index.ts`, `services/comms-svc/src/index.ts`,
  `services/admin-svc/src/index.ts` — each registers the hook once at
  bootstrap, so all of their JWT routes are covered without touching the
  individual route files.
- `packages/security/tests/active-role-hook.test.ts` (new) — 8 tests covering
  the no-op paths, pass, spoof-reject + audit, multi-role widening, cookie
  token source, and health/docs skip.

Safe by construction: a real single-role caller sends its own role and always
passes; only a client claiming a role its token doesn't grant is rejected.

Verified: `@aivo/security` builds + 61 tests pass; `assessment-svc`,
`comms-svc`, `admin-svc` build clean (`tsc`); changed files `eslint` clean.

## Changelog — Phase 2: mobile district-role scope clarified (#4)

Reframed #4 from an "incomplete" gap to **by design**. The mobile app's only
district-side users are **teacher** and **therapist**; both sign in through the
normal consumer `/api/auth/login` (they are never bounced) and have first-class
`(teacher)` / `(therapist)` route groups. `DISTRICT_ADMIN` and the internal
staff roles (`PLATFORM_ADMIN`, `SALES`, `MARKETING`, `CUSTOMER_CARE`,
`SUPPORT`, `FINANCE`, `DEVOPS`) are web-only: the consumer login `403`s them to
the admin/district web surfaces, and `apps/mobile/app/index.tsx` has no landing
for those roles (they fall through to the login screen). Letting them
authenticate on mobile would only dead-end them, so no mobile sign-in is wired
for them.

An earlier draft of this slice added a `wrongSurface` retry in
`useAuth.login()` (plus a `staff-surface` helper and tests) to log those roles
in on mobile; it was reverted because they are not mobile users. The
identity-svc surface separation (consumer vs. admin vs. district login
endpoints) is unchanged and remains correct for the web shells.

Verified: `@aivo/mobile` `eslint` clean; `tsc --noEmit` introduces no new
errors (one pre-existing unrelated `age-tiers` test import remains); existing
`vitest run` suites green.

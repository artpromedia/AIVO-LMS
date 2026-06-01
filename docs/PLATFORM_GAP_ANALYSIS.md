# AIVO-LMS — Platform Gap Analysis & Release-Readiness Evaluation

_Date: 2026-06-01 · Scope: monorepo `apps/`, `services/`, `packages/` + comparison against sibling repos in `artpromedia` org._

> **Goal of this evaluation:** be confident enough to (1) release the **web app for pilots** and
> (2) publish the **mobile app on the Apple App Store and Google Play**. This document catalogs the
> gaps, stubs, placeholders, and non-implementations that block those two goals, and gives a
> prioritized remediation plan — including what we can **port from sibling AIVO repos** rather than
> build from scratch.

---

## 0. Verdict

**Not yet ready for either goal — but the distance is shorter than it looks.**

The platform is **architecturally sound and surprisingly mature** (real DB migrations, token-hashed
invites, MFA admin login, SCIM-capable identity service, SOC2/audit scaffolding, release checklists,
universal-link manifests, EAS config). The problem is **not missing architecture** — it is that the
system runs on a **mock/in-memory "demo track" by default**, and the **polished admin UI is wired to
that demo track instead of the real backend that already exists**.

Three things must close before pilot + store submission:

1. **Wire the customer-facing admin flows to the real DB-backed backend** (district→school-admin,
   school-admin→teacher) and build the missing **invite-acceptance / account-creation** step.
2. **Flip the platform off "mock-by-default"** — persistence, auth, AI/TTS/speech providers, and the
   single-replica identity store all silently degrade to fake/volatile behavior unless explicitly
   configured.
3. **Fill the store-submission placeholders** (Apple Team ID, Play signing fingerprint, screenshots,
   iOS privacy manifest, data-safety/nutrition labels, EAS submit credentials).

Much of #1 is a **port-and-wire job** from `aivo-ai-learning` (the confirmed upstream, drop-in
compatible) and `aivo-platform` (best-of-breed admin UI).

---

## 1. The central finding: a dual-track architecture, defaulting to the mock track

There are effectively **two parallel implementations** of most flows:

| | "Demo track" (what ships by default) | "Real track" (exists, mostly unwired) |
|---|---|---|
| Persistence | `globalThis` Maps / `AIVO_PERSISTENCE=memory` | Drizzle + Postgres adapters, real migrations |
| Auth | `AUTH_MODE=mock`, `MOCK_USERS` | `identity-svc` login + MFA + step-up |
| Staff invites | in-memory registry, plaintext temp password, no email | `districtAdminInvites` (token-hashed) + Postmark via `comms-svc` |
| AI tutor / TTS / speech | `provider=mock` fake output | provider adapters (some still stubbed) |

`apps/web-v2/lib/env.ts` defaults: `AUTH_MODE=mock`, `AI_PROVIDER=mock`, `AIVO_PERSISTENCE=memory`,
`TTS_PROVIDER` → mock, `NEXT_PUBLIC_APP_URL=http://localhost:5000`. Production guards exist (the env
validator refuses `AUTH_MODE=mock`/`AI_PROVIDER=mock` in prod), but **persistence, providers, and the
admin-invite path are not covered by those guards** and will silently run in demo mode.

---

## 2. Core requirement — admin user-creation flows (district → school admin → teacher)

This is the flow you explicitly named. **Both halves are non-functional in the shipping web UI today.**

### 2A. District Admin → School Admin (web UI path) — **BLOCKER**

Path: `app/admin/district/staff/page.tsx` → `staff-invite-section.tsx` → `actions.ts` → `lib/db/staff-invites.ts`

- **A1 — In-memory `globalThis` store.** `lib/db/staff-invites.ts` keeps invites in
  `globalThis.__aivoStaffInvites` (no Postgres path at all, not even via the persistence adapter).
  Lost on restart; not shared across replicas/serverless workers.
- **A2 — No email; plaintext temp password shown on screen.** `actions.ts` returns
  `temporaryPassword`; the UI renders it with a "Copy" button and says "share out-of-band."
  `comms-svc` is never called. The "Send invitation" button sends nothing. _(Also a credential-handling
  red flag for any security review.)_
- **A3 — No account created, invite is un-acceptable.** `staff-invites` has **no consumer** anywhere.
  `/accept-invite` only handles learner care-team `team-invites`, not staff. The invited admin has no
  credentials in any auth store and no way to accept.
- **A4 — Role assignment is cosmetic** — a string on an in-memory record; never written to any RBAC store.

**The real backend already exists but is unwired:** `services/identity-svc/src/routes/district-admins.ts`
(`POST /api/district/admins`) validates role + tenant ownership, inserts a hashed-token row into
`districtAdminInvites`, and emails via `comms-svc` (`POST /api/comms/internal/school-admin-invite`,
real Postmark + durable outbox), behind real JWT + step-up. **web-v2's identity-client never calls it.**

- **A5 — Even the real backend lacks the final step (HIGH/latent):** no production route consumes the
  invite token to create the `users` row + set the password. Only `routes/test-helpers.ts` sets
  `acceptedAt`. So even after wiring, the acceptance endpoint must be built.

### 2B. School Admin → Teacher — **BLOCKER**

- **B1 — No teacher-create UI exists at all.** `app/admin/school/staff/page.tsx` is **read-only** (only
  `page.tsx`, no `actions.ts`, no form, no button). A school admin cannot add a teacher.
- **B2 — `requireSchoolAdmin` guard is dead code.** `identity-svc/src/hooks/require-school-admin.ts` is
  real and correct but **wired to zero routes**. No school-admin-scoped teacher endpoint exists.
- **B3 — The only real teacher-provisioning endpoint is district-admin-gated.**
  `identity-svc/src/routes/district.ts` `POST /api/district/staff` fully provisions a TEACHER
  (`users` row, `mustChangePassword`, `staffAssignments`, emailed credentials, audit) — but is gated by
  `requireDistrictAdmin`, so a school admin can't call it, and web-v2 never calls it anyway.
- **B4 — District-side teacher invite in the UI also uses the fake in-memory path** (same A1–A4).

### What to port (fastest path to enterprise grade)

From **`aivo-ai-learning`** (drop-in — shares our `enterprise-core`, drizzle, admin shell):
- `apps/web/src/app/dashboard/district/settings/admins/page.tsx` — peer-admin invite / deactivate /
  resend / revoke / temp-password reset, every mutation via `fetchWithStepUp`. Direct upgrade for our
  `admin/district/staff`.
- The district `staff/` + `staff/[id]/` pages → model for the **missing** `admin/school/staff` teacher
  CRUD.

From **`aivo-platform`** (best-of-breed UI, light adaptation):
- `apps/web-district/app/onboarding/setup/steps/InviteAdminsStep.tsx` — the clean
  `role: 'DISTRICT_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER'` cascade primitive.
- `apps/web-district/app/users/import/page.tsx` — **bulk CSV admin/roster import** (we lack this).
- `libs/ts-rbac/src/{roles.ts,permissions.ts}` — central **Role→Permission matrix** (mirrored in
  Python) to replace our predicate-only `enterprise-core/role-policy.ts`.

**Net:** wire the existing UI to `identity-svc`/`comms-svc`, build the token-acceptance route, add a
school-admin teacher endpoint guarded by the existing `requireSchoolAdmin`, and add the school-admin
teacher-create UI. Mostly porting, not greenfield.

---

## 3. Platform-wide critical blockers (beyond the admin flow)

### Tier 1 — data-loss / scalability (CRITICAL)
1. `services/identity-svc/src/routes/oidc-provider.ts` — OIDC auth codes in-memory, **single-replica
   only** (`TODO: move to Redis`). **Breaks horizontal scaling / rolling deploys outright.**
2. `services/recommendation-svc` — entire recommendation + profile store is `new Map()`.
3. `services/admin-svc/src/routes/content-cms.ts` — content packs in `_packStore` Map.
4. `services/problem-session-svc` & `services/audit-svc` — fall back to in-memory store when
   `DATABASE_URL` is unset (audit trail / analytics silently lost).
5. `services/homework-svc` — sessions in a Map; DB-persist failure logs a warning and **continues
   in-memory only**.
6. `apps/web-v2` `AIVO_PERSISTENCE=memory` default — most domains process-local unless flags flipped.

### Tier 2 — fake output served as real (HIGH)
- `AUTH_MODE` default `mock`; AI tutor default `mock`; TTS default `mock` (prod adapter **throws**);
  `speech-eval-svc` default `SPEECH_EVAL_MODE=mock` (random scores with `degraded:true`); push
  notifications in `comms-svc` are a **stub** (not delivered).
- `services/integration-svc/src/routes/sis.ts` — SIS import **validates but does not enroll**.
- `apps/marketing` contact route — leads `console.log`'d, not delivered, when `ADMIN_SVC_URL` unset.

### Tier 3 — enterprise features off by default (MEDIUM)
`packages/feature-flags/src/enterprise-flags.ts` ships 10 flags `false`: `sisSync`, `lti13`,
`dataGovernanceCenter`, `districtEnterpriseMode`, `responsibleAiGuardrails`, `problemSessionLedger`,
`tutorSurfaceProtocol`, `profileRecommendationsV2`, `advancedContentGenerators`, `selfRegulationHub`.
Pilots that need these must enable each explicitly.

---

## 4. Web pilot readiness (apps/web-v2)

**Strong scaffolding already present:** `next.config.ts` standalone + security headers,
`docker/Dockerfile.webapp` (multi-stage, non-root, healthcheck), env validation with prod guards,
real auth wired to `identity-svc`, error/not-found/global-error + per-role loading pages, health check,
request-id middleware, `no-demo-prod-scan.mjs` gate.

**Blockers (ranked):**
1. **`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` not in env template** — only a code comment warns. Without a
   stable key, login Server Actions 404 (`UnrecognizedActionError`) across replicas / redeploys.
2. **Production env wiring** — must set `DATABASE_URL`, `REDIS_URL`, real `SESSION_SECRET` (≥32, non-
   placeholder), `AUTH_MODE`+`IDENTITY_SVC_URL`, `AI_PROVIDER`+key, and **flip
   `AIVO_PERSISTENCE=postgres`** (default `memory` loses data on restart).
3. **`NEXT_PUBLIC_APP_URL`** defaults to `localhost:5000` — must be the pilot domain.
4. **`identity-svc` must be deployed** — login and page guards depend on it.
5. Stale `apps/web-v2/README.md` ("Sprint 2 will swap the mock auth") — docs only.

---

## 5. Mobile store readiness (apps/mobile — Expo managed)

**Already correct:** real bundle id/package `com.artpromedia.aivo`, version `1.0.0`, EAS remote
versioning + autoIncrement, 1024² icon + splash, `scheme: "aivo"`, iOS `associatedDomains`, Android
`intentFilters` (autoVerify), `usesNonExemptEncryption=false`, store copy (`description.md`,
`keywords.txt`, `whats-new.md`), single-listing CI gate.

**Blockers (ranked):**

_Apple App Store_
1. **AASA `TEAMID` placeholder** — `apps/web-v2/public/.well-known/apple-app-site-association` still has
   `TEAMID.com.artpromedia.aivo`. Universal links won't verify until the real Apple Team ID is inserted.
2. **Missing `PrivacyInfo.xcprivacy`** — Apple rejects data-collecting apps (we use SecureStore /
   required-reason APIs) without a privacy manifest.
3. **Zero screenshots** — `store-assets/screenshots/ios/**` only `.gitkeep`; need 6.7"/6.5"/5.5" sets.
4. **Privacy Nutrition Label data + privacy-policy/support URLs undocumented** — required ASC fields.
5. **Empty `submit.production` in `eas.json`** — no Team ID / ASC app id / App Store Connect API key.

_Google Play_
1. **`assetlinks.json` placeholder fingerprint** (`AA:BB:CC:…`) — App Links won't verify until the real
   Play signing SHA-256 is inserted.
2. **Zero screenshots** — `store-assets/screenshots/android/**` empty.
3. **Data Safety form inputs undocumented**; privacy-policy URL not recorded.
4. **Empty `submit.production`** — no Google service-account key / release track.
5. **`EXPO_PUBLIC_API_URL`** must be baked into the EAS production build (warn-only today).

_Process (both):_ `docs/launch-readiness.md` still has open COPPA Safe-Harbor, FERPA sign-off, and
pen-test items, plus developer-account artifacts.

---

## 6. Sibling-repo source map (what to copy, ranked)

1. **`aivo-ai-learning`** — confirmed upstream; **highest copy-compatibility**. Port: full
   district/admin pages, **SCIM 2.0 + SAML SSO** (`identity-svc/src/routes/scim.ts` + `0007_sso_scim.sql`
   + district SSO page), `packages/security/src/flags.ts` (typed flags incl. `AUDIT_IMMUTABLE`,
   `STEP_UP_AUTH`), hardened `admin-session.ts`, hash-chained `admin_audit_log` (+ impersonation column).
2. **`aivo-platform`** — best **admin UI**: `libs/ts-rbac` permission matrix (TS+Python), bulk CSV
   import, tenant-management + feature-flag platform console, impersonation console, billing/contracts,
   `InviteAdminsStep.tsx` cascade primitive.
3. **`aivo-v5`** — DB-backed RBAC permission-seed (`prisma/seeds/seed-permissions.ts`) + broad role
   enum if we want finance/IT/legal sub-admins. Reference only.
4. **`aivo`** — polished but mock-driven RBAC-delegation + provisioning-wizard UI. Design reference only.

_(Empty/irrelevant: `aivo-learning`, `aivolearning_`, `aivo-learning-saas`.)_

---

## 7. Prioritized remediation roadmap

### Phase 0 — Make "real mode" the default & safe (1–2 days)
- Add to `.env.example` + deploy docs: `AIVO_PERSISTENCE=postgres`, `AUTH_MODE`, `DATABASE_URL`,
  `REDIS_URL`, `SESSION_SECRET`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `NEXT_PUBLIC_APP_URL`,
  `EXPO_PUBLIC_API_URL`, provider keys.
- Extend prod env guards to also reject `AIVO_PERSISTENCE=memory`, mock AI/TTS/speech providers, and
  stubbed push in production (fail fast, don't degrade silently).

### Phase 1 — Make the admin creation flows real (the headline ask) (3–6 days)
- Wire `admin/district/staff` actions to `identity-svc POST /api/district/admins` + `comms-svc` email;
  delete the `globalThis` invite store + on-screen temp-password panel.
- Build the **invite-acceptance route** (token → create `users` row → set password → mark `acceptedAt`)
  and point `/accept-invite` (or a new staff path) at it.
- Add a **school-admin-scoped teacher endpoint** guarded by the existing `requireSchoolAdmin`; build the
  **teacher-create UI** under `admin/school/staff` (port from `aivo-ai-learning` district staff pages).
- Adopt the `aivo-platform` `InviteAdminsStep` cascade UI + central permission matrix.

### Phase 2 — Persistence & scale hardening (3–5 days)
- Move identity-svc OIDC codes to **Redis** (multi-replica blocker). Remove in-memory fallbacks in
  `audit-svc`, `problem-session-svc`, `homework-svc`, `recommendation-svc`, `admin-svc` content packs —
  or refuse prod boot when `DATABASE_URL` is unset.

### Phase 3 — Providers & enterprise features (parallel, scope to pilot)
- Wire real AI/TTS/speech providers (or explicitly disable those surfaces for the pilot).
- Enable the enterprise flags the pilot actually needs (`districtEnterpriseMode`, `sisSync`, etc.).
- Optional: port SCIM/SSO + immutable audit from `aivo-ai-learning` for enterprise pilots.

### Phase 4 — Store submission artifacts (2–3 days, partly non-engineering)
- Insert real Apple Team ID (AASA) + Play signing SHA-256 (assetlinks); run the well-known smoke gate.
- Add `PrivacyInfo.xcprivacy`; produce screenshots; fill ASC Nutrition Labels + Play Data Safety from a
  data-collection inventory; publish privacy-policy + support URLs; complete `eas.json submit.production`.
- Close `docs/launch-readiness.md` compliance items (COPPA/FERPA/pen-test).

---

## 8. Go / No-Go gates

**Web pilot — ship when:** admin creation flows persist to Postgres + send real email + support
acceptance (Phase 1); `AIVO_PERSISTENCE=postgres` and all required env set with prod guards (Phase 0);
identity-svc deployed; Server-Actions encryption key stable; OIDC codes in Redis if >1 replica.

**App store — submit when:** AASA/assetlinks real (links verify), `PrivacyInfo.xcprivacy` present,
screenshots uploaded, privacy/data-safety forms backed by a real inventory, `eas submit` credentials
configured, prod `EXPO_PUBLIC_API_URL` baked in, and the web pilot backend (which the app depends on) is
live.

---

## 9. Phase 1 implementation log (admin creation flows)

Worked on branch `claude/gifted-heisenberg-V9YJm`. Approach chosen: **real-auth with demo fallback**
(dual-mode), teachers onboarded via **email invite + set-password** (no out-of-band temp passwords).

**DONE**
- **Invite-acceptance keystone (the universally-missing piece).** `identity-svc`
  `GET /api/auth/invite/:token` + `POST /api/auth/accept-invite`: validates the hashed token, enforces
  password policy, creates the `users` row (role + school from the invite), marks the invite accepted
  (`acceptedAt` + `acceptedUserId`), audit-logs, and auto-logs the user in. Works for DISTRICT_ADMIN,
  SCHOOL_ADMIN, and TEACHER. DB-backed tests added. _Previously even the real backend had no production
  route to consume an invite token — this unblocks every staff invite._
- **Web acceptance flow.** `/accept-invite?token=…` now previews the invite and shows a real "set your
  password" form (BFF helpers `identityInvitePreview` / `identityAcceptInvite`), persists the session
  (auto-login), and redirects to the role home. Learner care-team flow unchanged.
- **School-admin → teacher (requirement #2 — complete end-to-end).** `identity-svc` `routes/school.ts`
  (`GET/POST /api/school/teachers` + revoke) guarded by the previously-dead `requireSchoolAdmin`;
  `comms-svc` `teacher_invite` template + `/api/comms/internal/teacher-invite`; web invite form on
  `admin/school/staff` (was read-only). Dual-mode: real identity-svc call when an access token is
  present, in-memory demo fallback otherwise.
- **`schoolId` login claim.** Every access-token mint (login, MFA-verify, refresh, register) now carries
  `schoolId` when present — required so SCHOOL_ADMIN tokens satisfy `requireSchoolAdmin` (no login path
  carried it before, so school admins could not use school-scoped endpoints at all).
- **District → school-admin/teacher console (requirement #1 — complete end-to-end).** The district staff
  console is now dual-mode: in real-auth it sources the school dropdown from `GET /api/district/schools`,
  lists pending invites (all staff roles, incl. teachers) from `GET /api/district/admins`, creates
  invites via `POST /api/district/admins` (DISTRICT_ADMIN / SCHOOL_ADMIN) or `POST /api/school/teachers`
  (teacher), and revokes via `DELETE /api/district/admins/invites/:id`. Success now shows "invitation
  emailed" instead of a plaintext temp password; the temp-password panel only appears in the demo
  fallback (no real token). BFF helpers: `identityListDistrictSchools`, `identityListDistrictAdmins`,
  `identityCreateAdminInvite`, `identityRevokeAdminInvite`.

**REMAINING (smaller follow-ups)**
- The district page's **stats cards + active-staff table** are still demo read models (the *creation*
  flow is real; these read surfaces are display-only and not yet sourced from the backend).
- **Step-up:** `POST /api/district/admins` is behind `requireStepUp`, which is flag-gated **off** by
  default — not a blocker for the default pilot, but when `STEP_UP_AUTH` is enabled the district console
  must complete a step-up challenge (web-v2 already has `step-up-verify` plumbing to build on).

### Phase 0 progress — fail-fast on unsafe production config

- **`AIVO_PERSISTENCE` production guard.** `apps/web-v2/lib/env.ts` now refuses `memory` (global and any
  `AIVO_PERSISTENCE_*` override) in production, mirroring the existing `AUTH_MODE`/`AI_PROVIDER` guards.
  A production deploy must explicitly set `postgres`, so it can no longer silently run on the volatile
  in-memory store (which would lose staff invites, audit trails, etc. on restart and break multi-replica).
- **`.env.example` now documents the web-v2 production-required vars** that were previously undocumented:
  `AUTH_MODE`, `AIVO_PERSISTENCE`, `AI_PROVIDER`, `SESSION_SECRET`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
  (with the multi-replica Server-Actions 404 caveat), `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, `REDIS_URL`.
- **In-memory store guards** added to `audit-svc` and `problem-session-svc` (refuse to boot without
  `DATABASE_URL` in production). `homework-svc` already had this guard.
- **Mock-provider guards (fake output served as real):**
  - `apps/web-v2/lib/tts/provider.ts` — `getTTSProvider()` no longer silently returns placeholder audio
    in production; `TTS_PROVIDER` must be set (`mock` is an explicit opt-in, not the silent default).
  - `services/speech-eval-svc` — refuses to boot in production unless `SPEECH_EVAL_MODE` is explicitly
    `live` or `mock`, so fake pronunciation/fluency scores can't be served as real by default.
  - `AUTH_MODE` and `AI_PROVIDER` already had production guards (refuse `mock`).

_Still open in Phase 0:_ `recommendation-svc` (and the `/api/comms/push` user-addressed stub) have no real
backend at all — they need a build-out (Phase 2/3), not a guard. The build-verified guards above are the
high-value fail-fast items.

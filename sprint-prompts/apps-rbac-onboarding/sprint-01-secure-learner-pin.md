# Sprint 01 — Secure learner PIN credentials and selected-learner binding

## Goal

At the end of this sprint, learner PIN authentication is a production-grade credential flow owned by `services/identity-svc`: PINs are never stored or compared in plaintext, server-side lockout exists, the auth contract binds the selected `learnerId`, and web/mobile callers use that secure contract end-to-end.

## Context

Pillar: **learner-PIN authentication**. This is the first 🚨 blocker because future login/onboarding work must not build on the current insecure PIN path.

Dual-stack reality: web-v2 has a hardened mock fallback (`apps/web-v2/lib/db/learner-pin-store.ts`) that uses scrypt, but production PIN auth runs in `services/identity-svc`. A fix that leaves identity-svc `users.pin = pin` reachable is not done.

Current verified evidence:
- identity-svc learner creation writes plaintext `pin: body.pin` while inserting a learner user: `services/identity-svc/src/routes/users.ts:356-362`.
- identity-svc `/api/auth/pin-login` currently requires only `parentId` and `pin`: `services/identity-svc/src/routes/auth.ts:1064-1075`.
- It queries `users.pin` directly with user input: `services/identity-svc/src/routes/auth.ts:1112-1116`.
- It mints a 2h learner access token after that plaintext match: `services/identity-svc/src/routes/auth.ts:1122`.
- Mobile receives a `learnerId` route param but calls `loginWithPin(newPin, parentId.trim())`, not a learner-bound contract: `apps/mobile/app/(auth)/pin.tsx:38-71`.
- The mobile auth hook posts `{ parentId, pin }`: `apps/mobile/hooks/useAuth.ts:211-216`.

Report mapping: closes **Gap 1 / R1** and the contract portion of **Gap 6**. Also covers capability cells **PIN hashed at rest 🔴**, **PIN rate limit/lockout 🔴/❓**, and part of **learner session scoping 🟡**.

## Work orders

### DELETE

- Delete the plaintext PIN query path in `services/identity-svc/src/routes/auth.ts`:
  - Remove any `.where(and(eq(users.role, "LEARNER"), eq(users.pin, pin)))` query.
  - Remove all logic that matches a learner by scanning all learner users under a parent and comparing `users.pin`.
- Delete plaintext PIN writes from `services/identity-svc/src/routes/users.ts`:
  - Remove `pin: body.pin` from learner user creation.
- Delete or deprecate any schema usage that treats `users.pin` as an active credential. If the physical column must remain for backward-compatible migration, it must be nulled/ignored and never read for auth.

### CREATE

- Create a production learner PIN credential service, for example `services/identity-svc/src/services/learner-pin.ts`, with:
  - `setLearnerPin(db, learnerUserId, rawPin, actorContext)`.
  - `verifyLearnerPin(db, parentIdOrEmail, learnerId, rawPin, requestContext)`.
  - Argon2id preferred because identity-svc already depends on `argon2`; scrypt is acceptable if consistent with repo standards.
  - Server-side failure counters and lockout by `(parentUserId, learnerId)` plus IP/device bucket if available.
  - No plaintext PIN returned or logged.
- Create/extend identity DB migration(s) for `learner_pin_credentials` or equivalent columns:
  - `learner_user_id`, `pin_hash`, `pin_set_at`, `failed_attempts`, `locked_until`, `updated_at`, and any Argon2 parameter metadata needed by the chosen library.
  - If migrating from existing plaintext `users.pin`, hash each existing PIN once, write the credential row, then null/remove the plaintext field.
- Create tests in `services/identity-svc/tests/` proving:
  - No stored credential is a raw 4–6 digit PIN.
  - Valid `{ parentId, learnerId, pin }` logs in.
  - Wrong PIN increments failures.
  - Lockout returns 429 with a remaining duration.
  - Same PIN on siblings cannot authenticate the wrong selected learner.

### REFACTOR

- Refactor `/api/auth/pin-login` in `services/identity-svc/src/routes/auth.ts` to require `{ parentId, learnerId, pin }`.
  - Resolve `parentId` as email or ID as before.
  - Load the `learners` row by both parent and selected learner ID.
  - Load the corresponding learner user through that row.
  - Verify the hashed PIN through the new service.
  - Mint a learner-scoped access token only for the selected learner's user.
  - Preserve the shorter learner session lifetime; keep or tighten the current 2h access token.
- Refactor identity-svc learner creation/update PIN endpoints to call `setLearnerPin`.
- Refactor `apps/web-v2/lib/bff/identity-learners.ts` and `apps/web-v2/app/api/bff/learners/[learnerId]/pin/route.ts` so setting a PIN writes to the secure identity-svc credential endpoint in production and never sends/stores plaintext beyond the one request.
- Refactor mobile auth types so `loginWithPin` takes `{ parentId, learnerId, pin }`, not `(pin, parentId)`.

### EDIT

- Edit `apps/mobile/app/(auth)/pin.tsx`:
  - Treat `learnerId` param as required for PIN entry when launched from learner selection.
  - If absent in manual parent-email flow, require learner selection before attempting PIN login, or call a secure discovery endpoint that returns selectable learner IDs without exposing sensitive data.
  - Pass selected `learnerId` to `loginWithPin`.
- Edit `apps/mobile/hooks/useAuth.ts`:
  - POST `{ parentId, learnerId, pin }` to `/api/auth/pin-login`.
  - Preserve learner-only session handling.
- Edit any OpenAPI/schema docs/tests for `/api/auth/pin-login` to require `learnerId`.
- Update any web-v2 tests/mocks that call the old PIN auth contract.

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **Credential & auth rules (any sprint touching PINs, sessions, or login):** no secret or PIN is ever stored or compared in plaintext — hash with Argon2id or scrypt and verify in constant time; the production service (identity-svc) owns hashing, verification, and server-side lockout (not client-only attempt counts); learner sessions carry a learner-scoped identifier, no adult capabilities, and a shorter lifetime; the PIN auth contract binds the selected `learnerId`.
- **Authorization rules (any sprint touching child-scoped routes):** enforcement is server-side on every endpoint (UI hiding is not a control); scope checks are role-aware (parent relationship / learner-self / accepted care-team membership / teacher roster), never "same-tenant existence"; add negative IDOR tests for caregiver, teacher, and therapist across brain, baseline, recommendations, lesson-run, observation, and learner-context routes.

## Definition of done

Report R1 DoD, verbatim:
- No query compares a plaintext PIN column to user input.
- Tests prove PINs are not stored as 4–6 digit plaintext, valid PIN logs in, wrong PIN increments lockout, locked PIN returns 429, and same PIN on sibling accounts cannot authenticate the wrong selected learner.

Additional observable behavior:
- Mobile learner profile selection followed by PIN login authenticates exactly that learner.
- Attempting to use sibling A's PIN for sibling B fails even if the parent ID is correct.
- Existing learner sessions still refresh according to learner TTL policy and have no adult capabilities.

Exact verification commands:
- `rg -n "users\.pin|eq\(users\.pin|pin:\s*body\.pin|pin\s*===|\.pin\s*===|WHERE .*pin" services/identity-svc apps/mobile apps/web-v2 --glob '!**/node_modules/**'`
- `corepack pnpm --filter @aivo/identity-svc test`
- `corepack pnpm --filter @aivo/mobile test`
- `corepack pnpm --filter @aivo/web-v2 test`
- `pnpm test`
- `rg -n "TODO|FIXME|stub|placeholder|mock|not implemented|coming soon" <changed production files>`

## Tests

Write or update:
- identity-svc PIN credential storage tests.
- identity-svc `/api/auth/pin-login` success/failure/lockout/sibling-collision tests.
- web-v2 BFF PIN-set tests covering identity-svc path and dev/mock path.
- mobile auth hook and PIN-screen tests for selected-learner binding.

Run the full suite (`pnpm test`) so previously completed sprints stay green.

## Out of scope

- Do not add the web login learner/adult toggle; that is Sprint 05.
- Do not implement the onboarding state machine; that is Sprint 04.
- Do not expand caregiver/teacher/therapist surfaces; Sprint 02 must land first.
- Do not change the brain approval ceremony beyond preserving existing lesson gating.

## Depends on

- No prior sprint in this track.
- Cross-track: do not weaken Assessment-UX one-gate/teach-gate work. Current code already enforces lesson approval at `createLessonRun`; preserve it.

## Checkpoint

At sprint end, summarize all changes, list tests run with results, include the grep proving no plaintext PIN comparisons remain, and pause for owner review. Do not commit unless explicitly instructed.

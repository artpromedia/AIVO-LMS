# Auth surface (Sprint 03 baseline)

This document is the map for everything authentication-related in
AIVO_LMS. It catalogs every endpoint, every page, every guard, and every
known gap. Update it whenever you touch an auth path.

## Authoritative service

`services/identity-svc` owns auth state. All web/mobile auth surfaces
must route to identity-svc via the BFF rewrites in
`apps/web/next.config.ts` (`/api/auth/*` →
`${IDENTITY_SVC_URL}/api/auth/*`).

## Endpoints (identity-svc, `apps/services/identity-svc/src/routes/auth.ts`)

| Method | Path                                      | Purpose                                           |
| ------ | ----------------------------------------- | ------------------------------------------------- |
| GET    | `/api/auth/public-key`                    | JWT verification public key                       |
| POST   | `/api/auth/register`                      | Parent / user signup                              |
| POST   | `/api/auth/login`                         | Password login                                    |
| POST   | `/api/auth/admin-login`                   | Internal admin login                              |
| POST   | `/api/auth/district-login`                | District admin login                              |
| POST   | `/api/auth/google`                        | Google SSO exchange (uses `email_verified` claim) |
| POST   | `/api/auth/pin-login`                     | Learner PIN unlock                                |
| POST   | `/api/auth/refresh`                       | Refresh access token                              |
| PUT    | `/api/auth/session/heartbeat`             | Extend live session                               |
| POST   | `/api/auth/logout`                        | Logout / revoke session                           |
| POST   | `/api/auth/forgot-password`               | Request reset email                               |
| POST   | `/api/auth/reset-password`                | Submit reset token + new password                 |
| PUT    | `/api/auth/password`                      | Authenticated password change                     |
| PUT    | `/api/auth/profile`                       | Authenticated profile update                      |
| DELETE | `/api/auth/account`                       | Self-service account deletion                     |
| DELETE | `/api/auth/learner/:learnerId`            | Remove a learner record                           |
| POST   | `/api/auth/verify-mfa`                    | Verify a step-up MFA challenge                    |
| POST   | `/api/auth/mfa/resend`                    | Resend MFA code                                   |
| POST   | `/api/auth/mfa/enable`                    | Enable MFA                                        |
| POST   | `/api/auth/mfa/confirm-enable`            | Confirm MFA enrollment                            |
| POST   | `/api/auth/mfa/disable`                   | Disable MFA                                       |
| GET    | `/api/auth/mfa/status`                    | Current MFA state                                 |
| POST   | `/api/auth/mfa/totp/enroll`               | Start TOTP enrollment                             |
| POST   | `/api/auth/mfa/totp/confirm`              | Confirm TOTP                                      |
| POST   | `/api/auth/mfa/totp/disable`              | Remove TOTP                                       |
| POST   | `/api/auth/mfa/webauthn/register/options` | WebAuthn enroll options                           |
| POST   | `/api/auth/mfa/webauthn/register/verify`  | WebAuthn enroll verify                            |
| GET    | `/api/auth/mfa/webauthn/credentials`      | List WebAuthn credentials                         |
| DELETE | `/api/auth/mfa/webauthn/credentials/:id`  | Remove a WebAuthn credential                      |
| POST   | `/api/auth/mfa/webauthn/login/options`    | WebAuthn login challenge                          |
| POST   | `/api/auth/mfa/webauthn/login/verify`     | WebAuthn login verify                             |
| GET    | `/api/auth/mfa/recovery/status`           | MFA recovery codes status                         |
| POST   | `/api/auth/mfa/recovery/regenerate`       | Regenerate MFA recovery codes                     |

### Known gaps to close in S03 follow-ups

The identity-svc auth surface is comprehensive in MFA, OAuth, password
reset, and session lifecycle, but there is **no native email
verification endpoint** for password-signup accounts. Google SSO uses
the `email_verified` claim directly, but a parent who signs up with
email + password cannot prove email control before learner data is
collected. Sprint 04 (consent) blocks child data collection on consent;
true email verification needs:

- `POST /api/auth/send-verification-email` (rate-limited, single-use
  token, audit logged)
- `POST /api/auth/verify-email` (consume token, set `email_verified=true`)
- `/verify-email` page on web and mobile that consumes the token from
  the URL and shows success/expired/already-used states

These three pieces are deferred to Sprint 03b (follow-up) because adding
them requires extending `services/comms-svc` for the verification email
template and audit-svc for the new event types. The placeholders are
intentionally not added as TODOs — when Sprint 03b lands it should add
real code, not stubs.

## Pages

### `apps/web` (legacy shell)

| Path                  | Status                   |
| --------------------- | ------------------------ |
| `/login`              | present                  |
| `/signup`             | present                  |
| `/forgot-password`    | present                  |
| `/reset-password`     | present                  |
| `/verify-mfa`         | present                  |
| `/accept-invite`      | present                  |
| **/verify-email**     | **missing** — Sprint 03b |
| **/account-recovery** | **missing** — Sprint 03b |

### `apps/web-v2` (role-grouped shell)

| Path                | Status                       |
| ------------------- | ---------------------------- |
| `/login`            | present, currently mock-only |
| `/signup`           | present, currently mock-only |
| `/forgot-password`  | missing                      |
| `/reset-password`   | missing                      |
| `/verify-mfa`       | missing                      |
| `/verify-email`     | missing                      |
| `/account-recovery` | missing                      |

web-v2's auth glue is `lib/auth/*`. It is mock-only by design until
Sprint 03b chooses one of `clerk` / `authjs` / `custom` to wire to
identity-svc.

### `apps/mobile`

| Screen                        | Status                   |
| ----------------------------- | ------------------------ |
| `(auth)/login.tsx`            | present                  |
| `(auth)/signup.tsx`           | present                  |
| `(auth)/forgot-password.tsx`  | present                  |
| `(auth)/reset-password.tsx`   | present                  |
| `(auth)/change-password.tsx`  | present                  |
| `(auth)/verify-mfa.tsx`       | present                  |
| `(auth)/pin.tsx`              | present                  |
| **`(auth)/verify-email.tsx`** | **missing** — Sprint 03b |

## Mock auth in web-v2 (production safety)

`apps/web-v2` ships a mock identity provider so role routing and surface
work can proceed before Sprint 03b's real auth lands. **It is hard-gated
against production exposure** at three layers:

1. **Env validator** (`lib/env.ts`). `AUTH_MODE` is required to be one
   of `"clerk" | "authjs" | "custom"` in production; passing
   `AUTH_MODE=mock` causes the process to fail at boot with a clear
   message.
2. **Session reader** (`lib/auth/mock-session.ts`). Both
   `readMockSessionFromCookies()` and `getMockSession(req)` short-circuit
   to `null` unless `serverEnv.AUTH_MODE === "mock"`.
3. **Mock-login route** (`app/api/bff/auth/mock-login/route.ts`). The
   POST handler refuses with `404 MOCK_AUTH_DISABLED` unless mock auth
   is allowed.

`scripts/auth-mode-audit.mjs` (root script `auth:audit`) verifies all
three guards stay in place; remove a guard and the script fails CI.

## Audit events

Every auth state change must emit an audit event via `services/audit-svc`.
At Sprint 03 baseline the following are wired in identity-svc (see
`services/identity-svc/src/services/*` for emitters):

- `auth.register`, `auth.login`, `auth.login.failure`,
  `auth.password.reset.requested`, `auth.password.reset.completed`,
  `auth.password.change`, `auth.mfa.challenge`, `auth.mfa.verify`,
  `auth.mfa.verify.failure`, `auth.mfa.enroll`, `auth.mfa.disable`,
  `auth.logout`, `auth.account.deleted`, `auth.learner.deleted`,
  `auth.session.refreshed`.

`docs/audit-event-taxonomy.md` is the authoritative event catalog. New
auth events should land in that catalog in the same PR that emits them.

## Verification

```bash
pnpm auth:audit         # mock-auth guards still in place
pnpm api:check          # identity-svc OpenAPI matches the generated client
pnpm test:enterprise    # enterprise-grade auth (MFA, district, SCIM)
pnpm test:production-readiness
```

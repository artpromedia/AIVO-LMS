# AIVO Security Architecture

This document captures the cross-cutting security posture of the AIVO
Learning Platform. It is intentionally short and operational — it tells
operators _what is true today_ and _what they must do_ to keep PII safe
in production.

## 1. Authentication & Authorization

### 1.1 End-user authentication

- All user sessions begin at `identity-svc` via password login or OAuth
  (Google, Apple, Clever, ClassLink).
- JWTs are signed RS256 with keys loaded from `JWT_PRIVATE_KEY` /
  `JWT_PUBLIC_KEY` environment variables (see `packages/security`).
- Access tokens are short-lived; refresh tokens are stored hashed
  (`hashRefreshToken`) in the `sessions` table and rotated on use.
- Refresh tokens are delivered as `httpOnly`, `secure` cookies in
  production; `sameSite=lax`.

### 1.2 Multi-Factor Authentication (MFA)

- **TOTP** (RFC 6238) is the primary second factor. Secrets are stored
  AES-GCM-encrypted in `users.totp_secret_encrypted`; the key comes
  from `MFA_ENCRYPTION_KEY` (KMS-wrapped in production).
- **WebAuthn / passkeys** are supported as a phishing-resistant
  alternative — credentials live in `webauthn_credentials` keyed by
  user. Either factor satisfies MFA on its own.
- **Recovery codes** — 10 single-use codes are generated when MFA is
  enrolled; each is hashed (sha256) before storage. Used codes are
  marked `used_at` and never reissued.
- **Email-OTP** remains as a fallback for users without TOTP/WebAuthn,
  rate-limited to 3 resends per code with a 10-minute TTL.
- Roles in `MFA_FORCED_ROLES` (platform admins, district admins, etc.)
  cannot disable MFA; tenants can additionally flip
  `featureOverrides.forceMfa` to require MFA for _all_ tenant staff.
- Login emits an `mfaPending` token if MFA is required, and the
  frontend exchanges it on `/verify-mfa` for a real access token +
  refresh cookie.

### 1.3 Service-to-service authentication

- Internal microservice calls (brain-svc → learning-svc, tutor-svc →
  learning-svc, etc.) authenticate with a shared secret:
  - Header: `x-service-token: ${INTERNAL_SERVICE_TOKEN}`
  - Optional: `x-internal-service: <caller name>` for log tracing.
- `learning-svc` and `tutor-svc` enforce this via a global `onRequest`
  hook (`registerAuthHook` in `lib/tenant.ts`) that requires _either_ a
  valid JWT _or_ a matching service token. Health and Swagger paths are
  the only exclusions.
- **Production requirement:** `INTERNAL_SERVICE_TOKEN` MUST be set to a
  long random string (>= 32 bytes). In dev, services fall back to a
  well-known string (`aivo-internal-dev-token`) so local hacking is
  unblocked; the fallback is disabled when `NODE_ENV=production`.

### 1.4 Tenant isolation

- `requireLearnerAccess()` in `services/*/lib/tenant.ts` is the strict
  guard for any learner-scoped read or mutation. It looks up the
  learner's `tenantId` and rejects callers whose JWT `tenantId` does not
  match (`PLATFORM_ADMIN` is the only bypass).
- Internal callers must present the service token; they are NOT trusted
  by IP address. The previous IP-allowlist bypass on
  `/api/learning/gradebook/update` has been removed.

### 1.5 Step-Up Authentication

- Sensitive operations (user delete, password reset, data export, evidence
  bundle download, district creation, district-admin management) require a fresh proof of
  presence even when the session is already authenticated.
- The client calls `requireStepUp(scope)` (in `apps/web/src/lib/step-up.ts`),
  which prompts for the second factor and exchanges the proof for a
  short-lived JWT (`scope`-bound, 5-minute TTL, single-use sub-bound).
- The token is sent on the next request as `x-step-up-token`. Server
  middleware (`requireStepUp(scope)` in identity-svc; mirrored helpers
  in admin-svc / district-svc) verifies the JWT, the scope, and that
  `sub` matches the caller's `sub` before allowing the operation.
- Defined scopes: `user:delete`, `user:reset-password`, `data:export`,
  `district:admin-mgmt`, `evidence:download`. Each scope is a SOC 2
  control reference — do not reuse one scope for an unrelated action.

- District onboarding adds `district:create` for tenant creation and reuses
  `district:admin-mgmt` for invite resend/revoke.
- Enforcement is flag-gated by `ADMIN_ENTERPRISE_STEP_UP_AUTH` and defaults off.

### 1.6 SAML SSO + SCIM provisioning

- Per-tenant SAML 2.0 federation backed by `samlsso` table; signed
  responses required, NameID = email.
- SCIM 2.0 endpoints under `/scim/v2/*` accept per-tenant bearer tokens
  managed via `/api/admin-svc/scim-tokens`. Tokens are sha256-hashed at
  rest with an 8-char display prefix; rotation issues a new token and
  revokes the prior.
- All SCIM mutations (Users + Groups create/update/deprovision) write
  to `admin_audit_log` with `actor_role = "SCIM"` and the originating
  tenant's id, so deprovisioning shows up in evidence bundles
  (CC6.3 — _least privilege & timely deprovisioning_).

## 2. Encryption

### 2.1 In transit

- Public traffic terminates TLS at the deployment edge (Replit Deployments
  proxy / Cloudflare).
- All cross-service HTTP calls are made over the platform's mTLS-protected
  internal network when deployed via Replit.

### 2.2 Sensitive PII column inventory

The following columns hold sensitive personally identifiable information
or authentication material and rely on database-level encryption at rest.
Operators MUST ensure the underlying storage is encrypted (see 2.3).

| Table              | Column(s)                                          | Sensitivity                        |
| ------------------ | -------------------------------------------------- | ---------------------------------- |
| `users`            | `email`, `name`, `passwordHash`, `lastLoginIp`     | PII + secret                       |
| `users`            | `mfaEnabled`, `mfaMethod`                          | Authentication metadata            |
| `learners`         | `name`, `dateOfBirth`, `iepData`, `accommodations` | Child PII (FERPA / COPPA)          |
| `mfaCodes`         | `code`                                             | Short-lived auth secret            |
| `sessions`         | `refreshToken`                                     | Stored hashed (`hashRefreshToken`) |
| `consentRecords`   | `parentName`, `parentEmail`, `signature`           | PII                                |
| `gradebookEntries` | `learnerId`, `masteryScore`                        | FERPA-protected academic record    |
| `lessonSessions`   | `learnerId`, `brainContextSnapshot`, `sessionData` | FERPA-protected                    |
| `brainStates`      | `functioning_level_profile`, `mastery_levels`      | Child PII (FERPA)                  |
| `parentMessages`   | `body`, `attachments`                              | Family PII                         |

### 2.3 At rest — database

- Application code does **not** add column-level encryption. Sensitive
  PII (emails, learner names, MFA codes, password hashes) lives in
  Postgres and depends on the storage layer for encryption at rest.
- **Production requirement:** the connection string MUST include
  `?sslmode=require` (or `verify-ca` / `verify-full` if a CA bundle is
  provided). `identity-svc` logs a startup `WARN` if it detects
  `NODE_ENV=production` without an `sslmode=*` parameter.
- Recommended provider settings:
  - **Neon / Supabase / RDS:** enable "Force SSL" and use the
    SSL-enforced connection string the provider gives you.
  - **Self-hosted Postgres:** enable `ssl=on`, install a real cert, and
    use `sslmode=verify-full` with the cert pinned in `PGSSLROOTCERT`.
- Refresh tokens are stored hashed (`hashRefreshToken`), never in
  plaintext.
- Passwords are stored as `argon2id` hashes via `verifyPassword` /
  `hashPassword` in `@aivo/security`.

### 2.3 At rest — object storage

- Family / integrations exports go to S3. Buckets MUST be configured
  with default SSE-S3 (or SSE-KMS for stricter tenants).
- Bucket policies must deny public read; access is via short-lived
  pre-signed URLs only.

## 3. Secrets Management

- All secrets are injected via environment variables (`.env.example` is
  the canonical inventory).
- Secrets MUST NOT be committed. CI runs TruffleHog on every PR with
  `--only-verified --fail` so a verified secret blocks merge.
- Required production secrets without a safe fallback:
  - `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`
  - `AUTH_SECRET`, `COOKIE_SECRET`
  - `INTERNAL_SERVICE_TOKEN`
  - `DATABASE_URL` (with `sslmode=require`)
  - `OONRUMAIL_API_KEY` (MFA + transactional email)

## 4. CI Security Gates

`.github/workflows/security-scan.yml` runs on every PR and on `main`:

| Gate             | Tool         | Failing severity                |
| ---------------- | ------------ | ------------------------------- |
| JS dep audit     | `pnpm audit` | HIGH or CRITICAL                |
| Python dep audit | `pip-audit`  | Any (strict mode)               |
| Filesystem CVE   | Trivy        | CRITICAL (SARIF for HIGH)       |
| Secrets in git   | TruffleHog   | Any verified finding            |
| Python SAST      | Bandit       | HIGH severity + HIGH confidence |

A `security-summary` aggregator job re-runs at the end and fails the
workflow if any individual gate failed, producing a markdown summary in
the GitHub Actions UI.

## 5. Operational Checklist (before going live)

- [ ] `INTERNAL_SERVICE_TOKEN` set to a 32+ byte random string.
- [ ] `DATABASE_URL` includes `sslmode=require` (or stronger).
- [ ] `NODE_ENV=production` set on every service.
- [ ] `CORS_ORIGINS` set to the explicit list of allowed origins (no
      `true` / no wildcard fallback).
- [ ] `COOKIE_SECRET` set to a 32+ byte random string.
- [ ] S3 buckets have SSE enabled and public access blocked.
- [ ] Security-scan workflow is green on the deploy commit.

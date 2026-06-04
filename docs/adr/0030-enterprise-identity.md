# 0030 — Enterprise Identity: SSO (SAML/OIDC), SCIM 2.0, and MFA step-up

- **Status:** Accepted
- **Date:** 2026-06-02
- **Related:** Sprint 1 — Enterprise Identity; `services/identity-svc`,
  `packages/sso`, `packages/security`; ADR 0018 (secrets management),
  ADR 0020 (single shell, multi-role identity)

## Context

AIVO sells into K-12 districts and higher-ed, where centralized identity
is a procurement gate. Customers expect to federate authentication to
their existing IdP (Okta, Microsoft Entra ID, Google Workspace, ADFS,
Ping), to provision and de-provision users automatically (SCIM 2.0), and
to enforce MFA — with **step-up** re-authentication before sensitive
administrative operations — aligned to NIST 800-63B AAL2.

Much of this surface already exists in the repository and predates this
ADR:

- **SAML 2.0 SSO** — `services/identity-svc/src/routes/sso.ts` backed by
  `@aivo/sso` (`@node-saml/node-saml`): per-tenant ACS, SP metadata,
  SP-initiated login, and Single Logout. Assertions are signature- and
  audience-validated; JIT provisioning is restricted to non-platform
  roles and is always tenant-scoped.
- **SCIM 2.0** — `services/identity-svc/src/routes/scim.ts`: Users and
  Groups CRUD, filter parsing, bearer tokens hashed at rest.
- **OIDC Provider** — `services/identity-svc/src/routes/oidc-provider.ts`:
  AIVO acting _as_ an IdP (auth-code + PKCE, JWKS, discovery) for internal
  tools and trusted partners.
- **MFA** — TOTP (`services/mfa-totp.ts`), WebAuthn
  (`services/mfa-webauthn.ts`), email OTP, lockout, recovery codes, and
  encryption-at-rest of secrets (`@aivo/security` `mfa-crypto`).
- **Step-up** — `services/step-up.ts` + the `requireStepUp(scope)`
  Fastify preHandler, with scope-bound, single-use (`jti`) tokens and a
  5-minute TTL; flag-gated by `ADMIN_ENTERPRISE.STEP_UP_AUTH`.
- **Admin UI** — district-scoped SSO settings under
  `apps/web-v2/app/admin/district/settings/sso`.

This ADR records the architecture and the **incremental additions** made
under Sprint 1 to close the genuine gaps, deliberately _reusing_ the
existing surfaces rather than duplicating them.

## Decision

### 1. OIDC Relying-Party (consume external IdPs)

The repository previously only implemented OIDC as a _provider_. We add
the **relying-party** side so a tenant can federate to an external OIDC
IdP, complementing SAML:

- `services/identity-svc/src/services/oidc-rp.ts` — a dependency-free
  (built on the already-present `jose` + global `fetch`) OIDC client:
  discovery (cached), PKCE S256, `state`/`nonce` generation, code
  exchange, and `id_token` validation (issuer/audience/expiry/nonce
  against the IdP JWKS). We intentionally did **not** add `openid-client`
  as a new dependency — `jose` already ships with the service and keeps
  the install surface (and CVE surface) small.
- `services/identity-svc/src/routes/oidc-rp.ts` — per-tenant routes:
  - `GET /api/sso/oidc/:slug/login` — SP-initiated login. Mints `state`,
    `nonce`, and a PKCE verifier, stashes them in a **signed, httpOnly
    transaction cookie** (stateless handshake, no server store), and
    redirects to the IdP authorization endpoint.
  - `GET /api/sso/oidc/:slug/callback` — verifies the transaction cookie,
    enforces `state` equality (CSRF), exchanges the code, validates the
    `id_token` (including `nonce`), and JIT-provisions the user.

JIT provisioning mirrors SAML exactly: it is **tenant-scoped** (an IdP for
tenant A can never assert an email owned by tenant B) and restricted to
`{DISTRICT_ADMIN, TEACHER, CAREGIVER, THERAPIST}` — SSO can never mint a
`PLATFORM_ADMIN`.

Per-tenant RP configuration is stored in
`district_settings.sso_config.oidc` (the client secret as an encrypted
envelope via `@aivo/security`), reusing the existing SAML config storage
and at-rest encryption. **No new migration was required.**

### 2. `amr` / `acr` authentication-context claims

We introduce `services/identity-svc/src/lib/jwt.ts` — the file named in
the sprint spec — as a thin wrapper over the generic `signJWT` from
`@aivo/security`:

- `amr` (Authentication Methods References): `["pwd"]` for single-factor,
  `["pwd","mfa"]` after a verified second factor / step-up.
- `acr` (Authentication Context Class Reference): `"aal1"` / `"aal2"`,
  derived from `amr`.

`signAccessToken()` centralizes the convention. It is adopted at the
federated-login sites (SAML ACS and OIDC RP callback issue `aal1`), and
`issueStepUpToken()` now stamps `amr=["pwd","mfa"]`, `acr="aal2"`. The
shared `@aivo/security` types are **not** modified — claims are attached
at the call sites — keeping the blast radius inside `identity-svc`.

### 3. `requireStepUp` middleware module

`services/identity-svc/src/middleware/requireStepUp.ts` provides:

- a re-export of the canonical `requireStepUp(scope)` gate (single source
  of truth), and
- `requireRecentMfa({ ttlSec })` — a complementary guard that requires the
  caller to have completed MFA within a **configurable** window (explicit
  option > `STEP_UP_RECENT_MFA_TTL_SEC` env > 300 s default), checking the
  step-up token's `amr` and `iat` recency. On failure it returns
  `401` with `WWW-Authenticate: StepUp`, the contract the web client's
  `lib/auth/stepUp.ts` interceptor uses to launch the challenge UI.

Both guards are no-ops until `ADMIN_ENTERPRISE.STEP_UP_AUTH` is enabled,
preserving the gated rollout.

## Feature flag

Enterprise identity remains behind `features.enterprise_identity`
(tenant-svc settings, default `false`) for UI/route gating, and step-up
enforcement behind `ADMIN_ENTERPRISE.STEP_UP_AUTH`. Code can land ahead of
the flips.

## Consequences

- Tenants can now federate via **either** SAML **or** OIDC, configured
  per-tenant, with consistent tenant-scoped JIT and role restrictions.
- Access tokens carry assurance metadata (`amr`/`acr`), enabling
  AAL-aware authorization decisions and audit.
- A second, lighter step-up primitive (`requireRecentMfa`) exists for
  flows that only need "MFA happened recently," distinct from the
  scope-bound single-use `requireStepUp`.
- No new runtime dependency and no new DB migration were introduced; the
  changes are additive and contained within `identity-svc`.

## Follow-ups (tracked, out of this change)

- Backfill `amr=["pwd"]` on the remaining `auth.ts` password-login token
  sites via `signAccessToken`.
- Platform-tier IdP catalog UI (`apps/web-v2/app/admin/platform/identity`)
  and BFF proxy routes for OIDC RP config + SCIM token issuance.
- Promote `district_settings.sso_config.oidc` to a first-class
  `idp_configs` table if multiple IdPs per tenant become a requirement.

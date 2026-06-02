# Enterprise Identity — Load & Security Gates (Sprint 1)

Tracks the load and security Definition-of-Done items for the SSO / SCIM /
MFA work (see ADR 0030).

## Load: SCIM `/Users` list

**SLO:** 100 requests/second sustained, **p95 < 300 ms**, error rate < 1%.

Test: `scripts/load/scim-users.k6.js` (k6, `constant-arrival-rate` at 100
rps for 3 minutes). It hits `GET /scim/v2/Users?startIndex=1&count=50` with
a bearer token and asserts a SCIM `ListResponse` envelope.

```bash
k6 run --env BASE_URL=https://identity.staging.aivolms.com \
       --env SCIM_TOKEN=$SCIM_BEARER \
       scripts/load/scim-users.k6.js
```

The `http_req_duration{endpoint:scim-users}: p(95)<300` threshold fails the
run if the SLO is breached, so it can gate a release in `load-test.yml`.

## Security: ZAP baseline on the identity API

`.github/workflows/zap-baseline.yml` gains a `zap-identity` job
(`zaproxy/action-api-scan`) that imports the identity-svc OpenAPI document
and exercises every documented operation — SAML ACS/metadata, OIDC RP
login/callback, SCIM Users/Groups, and the MFA enroll/verify/step-up
routes. Auth is injected via the `ZAP_IDENTITY_BEARER` secret; the OpenAPI
URL is configurable via `ZAP_IDENTITY_OPENAPI_URL` (defaults to
`/docs/json`). Runs weekly and on demand; reports upload as the
`zap-identity-report` artifact.

## XXE on SAML — verified mitigated

SAML response parsing goes through `@node-saml/node-saml` v5, which uses
`@xmldom/xmldom` + `xml-crypto`. These do **not** resolve external entities
or process DTDs, so XML External Entity (XXE) injection via a crafted
assertion is not possible. In addition:

- `wantAssertionsSigned: true` and `wantAuthnResponseSigned: true`
  (`packages/sso/src/index.ts`) reject unsigned/tampered assertions before
  any attribute is read.
- JIT provisioning is always tenant-scoped and restricted to non-platform
  roles, so even a forged-but-signed assertion cannot escalate.

A regression test asserting a DOCTYPE/entity-bearing assertion is rejected
should live in `services/identity-svc/tests` if the parser is ever swapped.

## SCIM bearer tokens — hashed at rest, redacted in logs

SCIM tokens are stored as **sha256 hashes** in the `scim_tokens` table and
looked up by hash on every request (`services/identity-svc/src/routes/scim.ts`,
`hashToken()`); the plaintext is shown to the operator exactly once at
issuance and never persisted. The web-v2 admin store mirrors this — only a
non-secret `last4` preview is retained
(`apps/web-v2/lib/db/idp-store.ts`).

## Status

| Gate | Mechanism | State |
|---|---|---|
| SCIM list p95 < 300ms @ 100 rps | `scripts/load/scim-users.k6.js` | Ready to run in `load-test.yml` |
| ZAP baseline on new endpoints | `zap-identity` job | Wired (needs `ZAP_IDENTITY_*` secrets) |
| No XXE on SAML | node-saml v5 + signed assertions | Verified by design |
| SCIM tokens hashed at rest | sha256 in `scim_tokens` | Verified in code |

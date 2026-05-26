# Key Rotation Policy

Sprint 16. Owner: Security lead. Operationalised by SRE on-call.
Referenced from `docs/security/soc2-control-matrix.md` (CC6.7, C1.3).

## 1. Key inventory

| Key                              | Purpose                                                | Where stored                                                 | Rotation cadence | Code                                                         |
| -------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ | ---------------- | ------------------------------------------------------------ |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | RS256 access/refresh + step-up JWT signing              | Vault `aivo/jwt/<kid>`                                       | 90 days          | `packages/security/src/index.ts` (`initKeys`)                |
| OIDC JWKs (PR #55)               | Outbound OIDC public discovery + inbound IdP verify    | `services/identity-svc/` (rotation script)                   | 90 days          | identity-svc (Sprint 12.7)                                   |
| `MFA_ENCRYPTION_KEY`             | AES-GCM at-rest encryption of TOTP secrets             | Vault `aivo/mfa/master`                                      | Annual           | `packages/security/src/mfa-crypto.ts`                        |
| Tenant KEKs (`KEK_<tenantId>_V<n>`) | Wraps per-attachment DEKs (envelope encryption)        | Vault `kek/<tenantId>/v<version>` via secrets-client (PR #55) | Annual or on incident | `packages/security/src/envelope.ts`                       |
| Webhook signing secrets          | Stripe / SCIM webhook verification                     | Vault `aivo/webhooks/<provider>`                              | On vendor rotation | per-service config                                          |
| Database TDE volume key          | Hetzner volume encryption (vendor-managed)             | Hetzner key store                                             | Vendor schedule  | n/a                                                         |
| Session cookie signing secret    | `@fastify/cookie` HMAC of admin session cookies        | Vault `aivo/cookies/<env>`                                    | 90 days          | `services/identity-svc/src/index.ts`                         |

## 2. KEK rotation procedure (envelope encryption — Sprint 16)

`packages/security/src/envelope.ts` honours a versioned KEK keyed by
tenantId. Wrapped DEKs include the KEK version that wrapped them, so
old payloads remain decryptable through a rotation window.

### Initiate

1. Bump `KEK_VERSION` env var on all writer services
   (`KEK_VERSION=2`). New writes wrap with v2.
2. Provision the new KEK in Vault at `kek/<tenantId>/v2` for every
   tenant. `secrets-client.rotate("kek/<tenantId>/v2")` performs the
   generate + store atomically.
3. Verify rotation: encrypt + decrypt a smoke payload using the new
   version (`pnpm --filter @aivo/security exec node -e ...`).

### Migrate

4. Run the background re-encryption job (TODO follow-up sprint):
   for every row in `iep_documents`, `caregiver_attachments`,
   etc., where `parsedData.__sealed === true` and `wrapped.v < 2`,
   decrypt with the old KEK and re-encrypt with the new.
5. Track progress via the migration dashboard.

### Retire

6. Once migration completes (audit query returns zero rows with
   `wrapped.v == 1`), call `secretsClient.delete("kek/<tenantId>/v1")`.
7. Update `docs/security/soc2-control-matrix.md` C1.3 evidence row.

### Recovery

If a KEK is suspected compromised, rotate IMMEDIATELY (skip the
"verify with smoke payload" step) and trigger the incident response
runbook (`docs/security/incident-response-runbook.md` § 5.1).

## 3. JWT signing key rotation

The identity-svc maintains the active `kid` in its OIDC discovery
endpoint; clients verify against the published JWKS. Rotation
procedure:

1. Generate a new RS256 keypair via the rotation script in
   identity-svc (`pnpm --filter @aivo/identity-svc rotate-jwk`).
2. Publish the new public key to JWKS (the old key stays in the JWKS
   list until all live tokens expire — at most 1 token TTL).
3. Switch the active signing key (the writer prefers the newest).
4. After 2x the longest-lived token TTL, remove the old key from
   JWKS.

## 4. Verification gates

Each rotation produces an evidence artifact uploaded to S3:

- KEK rotations: hash of the wrapped sample roundtrip + Vault audit
  log line.
- JWT rotations: JWKS snapshot before/after + first successful
  verification timestamp.
- MFA master rotations: re-encrypted TOTP secret count.

These artifacts satisfy the SOC 2 CC6.1 + CC6.7 evidence
expectation when the auditor asks "show me a rotation".

## 5. Calendar

See `docs/security/annual-review-calendar.md` — quarterly key-rotation
review is part of Q3 (training refresh) and Q4 (SOC 2 audit prep).

# ADR 0018: Secrets management

- Status: Accepted
- Date: Sprint 12.7
- Deciders: Platform Engineering

## Context

Across Sprints 1-12 the AIVO services have grown to depend on roughly 60 distinct secrets (API keys, signing keys, webhook HMAC secrets, internal service tokens). These are currently sourced from `process.env`, populated by the deploy pipeline from CI-level secrets. This works, but:

- There is no abstraction for services to read secrets — they each call `process.env.X` directly. Migrating to a managed store later would touch every service.
- Rotation is manual: change the secret in CI, redeploy, hope the rolling restart is consistent.
- Some secrets (Stripe restricted keys, FCM service-account JSON, APNs `.p8`) are large enough that storing them as env vars is awkward.

## Decision

1. Introduce a `SecretsClient` abstraction in `packages/security/src/secrets-client.ts`. Services depend only on the interface.
2. `SECRETS_PROVIDER` selects the backend at boot:
   - `vault` (default in production) — HashiCorp Vault KV v2. Reads `VAULT_ADDR`, `VAULT_TOKEN`, optional `VAULT_KV_MOUNT`.
   - `aws` — AWS Secrets Manager. Reads `AWS_REGION` (and the standard SDK credentials chain).
   - `env` (default in dev / test) — direct `process.env` access.
3. Vault is the default for production; AWS Secrets Manager is the documented alternate for deployments without a Vault cluster (e.g. single-region AWS-hosted environments).
4. Bootstrap configs for Vault live in `infra/vault/` (HCL). These are not executed in CI — they document the structure operators apply manually during cluster provisioning.

## Rotation policy

| Secret class                                         | Rotation cadence                | Mechanism                                      |
| ---------------------------------------------------- | ------------------------------- | ---------------------------------------------- |
| AUTH_SECRET, COOKIE_SECRET, SESSION_SECRET           | Quarterly                       | Vault `pki/issue` + rolling restart            |
| INTERNAL_SERVICE_TOKEN, INTERNAL_AI_TOKEN            | Semi-annually                   | Vault transit + rolling restart                |
| STRIPE_SECRET_KEY (restricted)                       | Annually or on compromise       | Stripe Dashboard + Vault write                 |
| FCM_SERVICE_ACCOUNT_JSON                             | On Apple/Google rotation events | Vault write                                    |
| APNS_PRIVATE_KEY                                     | Annually                        | Vault write                                    |
| OIDC signing keys (`oidc_signing_keys` table)        | Quarterly                       | `POST /oidc/rotate` from the housekeeping cron |
| POSTMARK_WEBHOOK_SECRET, MAILGUN_WEBHOOK_SIGNING_KEY | On vendor key rotation          | Vault write + redeploy                         |

## Consequences

- Services gain a tiny dependency surface for secrets retrieval, but the actual env-var fast path remains available for development.
- Switching providers (Vault ↔ AWS SM) is a one-line config change, not a code change.
- The OIDC signing-key rotation is handled in-application (table-backed) because publishing JWKS requires application-level state; only the rotation trigger is operator-controlled.

## Alternatives considered

- **Doppler / SOPS-encrypted env files** — both were prototyped during Sprint 9 but failed the rotation-audit requirement: neither produces a tamper-evident rotation log.
- **No abstraction, env vars only** — keeps the codebase simpler but locks us into a single provider and makes rotation drift hard to detect.

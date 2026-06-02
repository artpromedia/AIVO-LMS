# AIVO OIDC Provider

Sprint 12.7 ships a minimal OpenID Connect Provider for trusted internal tools and partner integrations. It is **not** intended as a public IdP — the surface is intentionally small (auth-code + PKCE only).

## Discovery

`GET /.well-known/openid-configuration` returns the discovery document with the issuer set from `OIDC_ISSUER` (or `IDENTITY_PUBLIC_URL`, or the request host).

## Endpoints

| Method | Path              | Purpose                                                                                         |
| ------ | ----------------- | ----------------------------------------------------------------------------------------------- |
| GET    | `/oidc/jwks.json` | Published JWK set (RS256).                                                                      |
| GET    | `/oidc/authorize` | Auth-code flow with PKCE (S256). Redirects to `/login?next=` when there is no session cookie.   |
| POST   | `/oidc/token`     | Exchanges code for `access_token`, `refresh_token`, `id_token`. Supports `refresh_token` grant. |
| GET    | `/oidc/userinfo`  | Returns claims for the bearer access token.                                                     |
| POST   | `/oidc/rotate`    | Operator-only (`x-service-token`) — marks the active key rotated and provisions a fresh one.    |

## Supported

- Response types: `code`
- Grant types: `authorization_code`, `refresh_token`
- PKCE methods: `S256` (required)
- Token endpoint auth: `client_secret_post`, `none`
- Signing algs: `RS256`
- Scopes: `openid`, `email`, `profile`
- Claims: `sub`, `email`, `email_verified`, `name`, `preferred_username`, `role`

## Key rotation

Keys live in `oidc_signing_keys` (migration 0044). The active key is used for signing; up to five recent keys are published via JWKS so existing tokens stay verifiable across rotations. Rotate via `POST /oidc/rotate` with the `INTERNAL_SERVICE_TOKEN` shared secret — this is intended to be called by the scheduled housekeeping cron, not a user.

## Storage

The current implementation keeps authorization codes and access tokens in process memory. Single-replica deployments are fine; a planned follow-up (`TODO(sprint-13)` in `services/identity-svc/src/routes/oidc-provider.ts`) moves the stores to Redis ahead of multi-replica rollout.

## Environment

| Var                      | Purpose                                                                      |
| ------------------------ | ---------------------------------------------------------------------------- |
| `OIDC_ISSUER`            | Stable issuer URL exposed in discovery. Defaults to identity-svc public URL. |
| `INTERNAL_SERVICE_TOKEN` | Authorises `POST /oidc/rotate`.                                              |

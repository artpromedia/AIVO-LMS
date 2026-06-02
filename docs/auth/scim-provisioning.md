# SCIM 2.0 Provisioning (AIVO)

Sprint 12.7 closes out the SCIM 2.0 surface that ships with `identity-svc`. AIVO is a **SCIM target** — districts configure their IdP (Okta, Azure AD, JumpCloud, OneLogin) to provision into AIVO via the endpoints below.

## Endpoints

All endpoints are mounted under `/scim/v2/*` on `identity-svc`.

| Method                | Path                     | Notes                                                                                                 |
| --------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------- |
| GET                   | `/ServiceProviderConfig` | Public per RFC 7644 §4.                                                                               |
| GET                   | `/Schemas`               | Public.                                                                                               |
| GET                   | `/ResourceTypes`         | Public.                                                                                               |
| GET                   | `/Users`                 | Filter (eq + and/or), `startIndex`, `count` per RFC 7644 §3.4.2.                                      |
| POST                  | `/Users`                 | JIT into the tenant bound to the bearer token.                                                        |
| GET                   | `/Users/:id`             | Tenant-scoped.                                                                                        |
| PUT                   | `/Users/:id`             | Full replace.                                                                                         |
| PATCH                 | `/Users/:id`             | Path-based ops per RFC 7644 §3.5.2.                                                                   |
| DELETE                | `/Users/:id`             | Soft-delete (sets `deactivatedAt`); emits audit event.                                                |
| GET                   | `/Groups`                | Lists virtual role-derived groups.                                                                    |
| GET                   | `/Groups/:id`            | Returns active members.                                                                               |
| POST/PUT/PATCH/DELETE | `/Groups*`               | Refused with SCIM `mutability` (400). Groups are role-derived; mutate `aivoRole` on the user instead. |

## Authentication

Bearer token issued from the district SSO settings UI. Stored as a SHA-256 hash in `scim_tokens` and scoped to one tenant. The token's `tenantId` is bound to every request so a token issued for district A can never operate on district B.

## Provisionable Roles

Only `DISTRICT_ADMIN`, `TEACHER`, `CAREGIVER`, `THERAPIST`. Any attempt to assign `PLATFORM_ADMIN` (via `aivoRole`, the enterprise `department` extension, or a PATCH path) is rejected with HTTP 403 / SCIM `noTarget`.

## Auditing

Every successful POST / PUT / PATCH / DELETE on `/scim/v2/Users/:id` emits a hash-chained entry in `admin_audit_log`:

- `SCIM_USER_CREATED`
- `SCIM_USER_REPLACED`
- `SCIM_USER_PATCHED`
- `SCIM_USER_DEACTIVATED`

`actorId` is the SCIM token ID, `actorRole` is `SCIM_TOKEN`, `tenantId` is the token's bound tenant. Audit failures are intentionally non-blocking — the mutation has already committed; we don't want a transient write failure to break SCIM clients' retry semantics.

## Filter parser

Supports the subset SCIM clients actually emit during initial sync:

- `userName eq "x"`
- `emails.value eq "x"` (also `emails eq "x"`)
- `active eq true | false`
- `externalId eq "x"`
- `id eq "x"`
- Compound `<expr> and <expr>`, `<expr> or <expr>`

Anything unsupported falls back to "no extra filter" (returns the tenant scope alone) instead of 400ing — matches Okta's expected behaviour during reconciliation runs.

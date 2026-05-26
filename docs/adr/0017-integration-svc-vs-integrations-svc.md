# 0017 — `integration-svc` vs `integrations-svc` (keep them split)

- **Status:** Accepted
- **Date:** 2026-05-26
- **Deciders:** Platform Engineering, Enterprise Engineering
- **Related:** Sprint 08 (enterprise core / LTI 1.3 / SIS), Sprint 10 (third-party
  connector OAuth + sync), Sprint 12.6 (this ADR), `scripts/repo-health-check.mjs`,
  `scripts/backend-parity-check.mjs`

## Context

The repository ships two superficially-similar Fastify services with
nearly-identical names:

- `services/integration-svc` (singular) — owns the enterprise-core /
  SIS / LTI 1.3 validation surface introduced in Sprint 08. Its
  responsibilities are:
  - LTI 1.3 launch validation (JWT signature, deployment id, target
    link uri, nonce replay).
  - OneRoster-shaped SIS provider interface (`NormalizedExportSisProvider`)
    and the Clever / ClassLink export adapters that feed it.
  - Tenant- and platform-admin endpoints that exercise the LTI / SIS
    contract for enterprise customers.
  - Stateless: no persistence layer, no scheduled jobs. The caller
    (admin-svc / identity-svc) persists whatever the service validates.

- `services/integrations-svc` (plural) — owns the third-party connector
  marketplace introduced in Sprint 10. Its responsibilities are:
  - OAuth 2.0 authorization-code flow (`/api/integrations/oauth/...`)
    against Google Classroom, Clever, ClassLink, Canvas LMS.
  - Persistent roster sync via `@aivo/db` (`integrationConnections`,
    `integrationSyncLogs`, `integrationRosterMappings`).
  - A `coming_soon` waitlist + admin-listable signup table.
  - The `integrations.connector-sync-watchdog` scheduled job (Drizzle
    advisory-lock + ledger) that reaps stuck sync runs.

A drive-by reader sees two services with overlapping names and assumes
duplication / drift. `scripts/repo-health-check.mjs` historically
treated both as `unexpected services` because the original Sprint 00
workspace contract only listed the singular service; it now warns on
neither.

## Decision

**Keep `integration-svc` and `integrations-svc` as separate workspaces.**
They share a marketing-level domain ("integrations with external
systems") but split cleanly on the axes that matter:

| Axis | `integration-svc` | `integrations-svc` |
| --- | --- | --- |
| Sprint origin | Sprint 08 (enterprise core) | Sprint 10 (connector marketplace) |
| Persistence | None (stateless validator) | Drizzle / Postgres |
| Background jobs | None | `connector-sync-watchdog` cron |
| Sensitivity | Validates auth assertions / SIS exports | Stores OAuth refresh tokens + roster mappings |
| Failure mode | LTI launch rejected | Roster drift / stale credentials |
| Public surface | LTI / SIS verification endpoints | OAuth callback + connector CRUD + sync |

These different lifecycles (LTI spec churn vs OAuth provider drift),
different blast radii (assertion validation vs persisted refresh tokens),
and different release cadences (enterprise quarterly vs district-onboarding
weekly) mean that a single workspace would have to grow per-feature
flags to disable one half without the other — exactly the kind of
coupling we are trying to avoid.

### Import discipline

Cross-service imports between these two workspaces must go through the
stable public exports only (the package's `exports` map and the route
schemas published via Swagger). Reaching into `src/` paths across the
boundary is forbidden and should be caught at lint time by the existing
`no-restricted-imports` policy. If a helper needs to be shared, it must
be hoisted into a `packages/*` workspace first.

## Consequences

**Positive**

- Each service owns a single, narrowly-scoped contract; on-call rotations
  and security review checklists can target the relevant service without
  pulling in unrelated surface area.
- The Sprint 10 connector marketplace can iterate on OAuth provider
  drift (Google / Clever / ClassLink rotating scopes) without forcing
  a redeploy of the LTI / SIS validation surface.
- The backend parity matrix (`docs/quality/backend-parity-matrix.md`)
  remains accurate: each row maps 1:1 to a deployable artifact.

**Negative**

- Two services to monitor, two health checks, two CI pipelines.
- Newcomers must read this ADR before touching either workspace.

## Consolidation criteria

The two services should be merged if **all** of the following become
true (today, none of them are):

1. The OAuth marketplace persistence is removed (or extracted into its
   own data-plane service) such that `integrations-svc` becomes
   stateless too.
2. The LTI 1.3 / SIS validation surface grows persistent state of its
   own (e.g. caching IdP JWKS or storing per-tenant deployment metadata)
   such that `integration-svc` needs the same `@aivo/db` + `@aivo/scheduling`
   plumbing already in `integrations-svc`.
3. The two workspaces' release cadences converge (enterprise + district
   onboarding both shipping on the same train).
4. Combined, the two services would still fit in a single on-call
   rotation budget (< 20 routes, < 6 background jobs, single security
   review surface).

Until the four conditions hold simultaneously, the cost of merging
(invalidating two months of operational muscle memory, flattening two
distinct sprint deliverables into one) exceeds the cost of keeping
them split. Re-evaluate at S16 alongside the `ops-alert` retirement
(see ADR 0018).

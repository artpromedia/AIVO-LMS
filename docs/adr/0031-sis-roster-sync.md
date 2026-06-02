# 0031 — SIS Roster Sync: OneRoster 1.2, Clever, ClassLink

- **Status:** Accepted (incremental — see "Delivered vs tracked")
- **Date:** 2026-06-02
- **Related:** Sprint 2 — SIS Roster Sync; `services/integration-svc`,
  `apps/web-v2`; legacy ADR 106 "SIS Sync Status card"; ADR 0030
  (enterprise identity, the downstream provisioning target).

## Context

Districts roster AIVO from their Student Information System (PowerSchool,
Infinite Campus, Skyward, Aeris, Synergy) via one of three rostering
standards/providers: **OneRoster 1.1/1.2** (REST + CSV), **Clever Secure
Sync**, and **ClassLink Roster Server**. We need a reliable, observable,
idempotent pipeline that ingests Orgs, Users, Classes, Enrollments,
Courses, and AcademicSessions and provisions them into `identity-svc` /
`tenant-svc`, with a district-admin UI for status, errors, and manual
resync.

## Decision

### Canonical schema (`src/types/canonical.ts`)

Every connector extracts into one provider-neutral model — the OneRoster
1.2 data model (`Org`, `User`, `Class`, `Enrollment`, `Course`, `Term`,
`Demographics`). Identity is always the pair `(provider, sourcedId)`,
resolved to an internal id through the `sync_mappings` table. The rest of
the pipeline and all downstream events speak only this vocabulary.

### Connectors (`src/connectors/`)

- **oneroster/csv.ts** — dependency-free RFC 4180 reader + 1.1/1.2 bulk
  import (multi-value columns, `roles[]` or single `role`, `tobedeleted`).
- **oneroster/rest.ts** — REST 1.1/1.2 with OAuth2 `client_credentials`,
  paged GETs, GUIDRef mappers; `fetch` injectable for tests.
- **clever/index.ts** — Clever Data API v3.0 (`{data,uri}` envelopes;
  sections expand to a Class + N Enrollments; role-map → canonical roles).
- **classlink/index.ts** — ClassLink Roster Server is OneRoster 1.1, so it
  reuses the REST connector and re-tags `provider: "classlink"`.

### Pipeline (`src/pipeline/`)

`extract → transform → diff → apply` with reconciliation:

- **transform.ts** — idempotent canonicalization (sort/dedupe/normalize).
  `normalize(normalize(s))` deep-equals `normalize(s)` (property-tested).
- **diff.ts** — add/update/delete sets keyed by sourcedId; change detection
  via a stable fingerprint; `tobedeleted` ⇒ removal. A steady-state
  snapshot diffed against itself yields zero changes (idempotent re-sync).
- **apply.ts** — realises the diff against a pluggable `RosterWriter` port,
  with the safety rails below.
- **reconcile.ts** — orphan detection (known ids absent from the incoming
  snapshot) with an empty-payload **outage floor** that refuses to orphan a
  whole population when a provider returns nothing.

### Idempotency & safety rails

- All upserts keyed by `(provider, external_id) → internal_id`.
- **Soft-delete only** — removals call `softDelete` (state inactive +
  effective date); the writer port has no hard-delete.
- **Mutation cap** — a run that would mutate more than `maxMutationRatio`
  of the tenant population (default **10%**) pauses and writes nothing
  until a platform admin approves (`overrideCap`).
- **Dry-run** — compute the plan + counts, emit events, write nothing.

### RBAC

| Action | platform_admin | district_admin | school_admin |
|---|---|---|---|
| Configure connector | ✅ | ✅ (own) | ❌ |
| Trigger manual sync | ✅ | ✅ (own) | ❌ |
| View status / errors | ✅ | ✅ (own) | ✅ (read-only) |

Enforced in the BFF via `lib/bff/sis-guard.ts` (`requireSisManager` for
mutations, `requireSisViewer` for reads, `authorizeManageTenant` for tenant
scoping).

### Frontend

District connector list, detail (run history, error drill-down with CSV
export + retry, config editor), the connector wizard, and a platform-wide
overview — built on the established mock-backed BFF pattern. The
`SyncStatusCard` is the modernized port of legacy ADR 106.

### Audit & events

Every config change, manual trigger, retry, and per-run row-mutation
summary is emitted to `audit-svc` (via `recordAudit` in the BFF today).
The pipeline is the producer of `roster.user.*`, `roster.class.*`, and
`roster.enrollment.changed` to the event bus.

## Delivered vs tracked

**Delivered in this PR (additive, verified):** canonical schema; OneRoster
REST + CSV, Clever, and ClassLink connectors with fixture-based contract
tests; the transform/diff/apply/reconcile pipeline with property + safety
tests (29 unit tests green); the full district + platform admin UI, BFF,
mock store, i18n (10 locales), and E2E + axe a11y specs (all green).

**Tracked for a dedicated follow-up** (each needs full-repo / live-stack
verification and is intentionally *not* half-done here):

1. **Service consolidation** — the spec's pre-work to merge
   `integrations-svc` into the canonical `integration-svc`. References span
   `packages/api-client` (a dedicated `integrations-svc` submodule),
   `tests/integration`, `packages/scheduling`, `status-page-svc`, and five
   deploy/CI workflows. A partial or unverified merge would break
   production deploys, so it must be its own PR that updates every import,
   docker-compose, Helm chart, and workflow and is validated end to end.
2. **BullMQ worker pool** (`sync.full` / `sync.delta` / `sync.row` with
   per-record exponential backoff) + the dedicated Helm worker deployment.
3. **DB migrations** — `sis_configs`, `sync_runs`, `sync_rows`,
   `sync_errors`, `sync_mappings` — and the real `load.ts` writes to
   identity-svc / tenant-svc behind the `RosterWriter` port (the port and
   its safety logic already exist and are tested).
4. **Cron schedules** (full 02:00 tenant-local, delta every 4h) via
   `@aivo/scheduling`, and **KMS envelope encryption** of SIS credentials
   at rest (the UI/store already keep only a masked hint).
5. **Scale/chaos tests** — 50k-row integration run < 10 min and worker-kill
   resume-from-checkpoint — which depend on the queue + DB above.

The runbook for operating the pipeline lives at
`docs/runbooks/sis-sync.md`.

# 0032 — Audit Trail Architecture: hash chain + retention

- **Status:** Accepted (incremental — see "Delivered vs tracked")
- **Date:** 2026-06-02
- **Related:** Sprint 3 — Audit Trail Surfacing; `services/audit-svc`,
  `packages/audit-client`, `apps/web-v2`; ADR 0030 (identity), ADR 0031 (SIS).

## Context

SOC 2 / ISO 27001 / FERPA evidence collection requires a tamper-evident,
append-only audit log of every sensitive admin action, queryable and
exportable at platform, district, and school scope, with retention aligned
to FERPA (~7 years). `audit-svc` already existed with a basic
`/api/audit-events`; this sprint adds the tamper-evident `/events` surface,
a shared producer client, scoped admin UIs, and retention.

## Decision

### Hash chain (why, and the algorithm)

Every event stores `prev_hash` and `hash = sha256(prev_hash ||
canonical(payload))`, where `payload` is the event minus the chain fields
and `canonical` is stable JSON (sorted keys, no whitespace). Walking the
chain detects **any** tamper — insert, update, delete, or reorder — because
each event's hash depends on its predecessor. We reuse
`@aivo/security`'s `computeAuditHash`/`canonicalize` so the algorithm
matches the platform's other append-only logs.

`prev_hash`/`hash` are assigned **server-side on append** (audit-svc reads
the current chain head), not by producers — this removes the race a
client-computed chain would have and keeps producers simple.

Why a hash chain rather than just append-only + WAL: append-only DB
permissions stop casual mutation, but a privileged actor (or a compromised
DB) could rewrite history. The chain makes any rewrite detectable, and a
**daily anchor** (chain head hash + count) written to WORM / object-lock
storage (`audit_anchors`) makes even a full-table rewrite detectable
against the externally-stored anchor.

### Storage & indexes

`audit_events` (migration 0048) is **range-partitioned by month** on
`occurred_at`, so retention prune/archive is a fast `DETACH`/`DROP` per old
partition rather than a mass `DELETE`. Hot-path indexes: **BRIN** on
`occurred_at` (the table is naturally time-clustered, so BRIN is tiny and
fast for range scans), **btree** on `tenant_id`, `action`, `actor_id`, and
`(entity_type, entity_id)`. An `UPDATE`/`DELETE`-blocking trigger enforces
append-only at the row level (archival uses partition detach, never row
deletes).

### Producer client — `@aivo/audit-client`

A new package with `audit.emit(...)` (best-effort, non-blocking — a failed
emit never breaks the user's request) and the `@audited("action")` route
annotation + `registerAuditHook` that auto-emits on response (outcome from
the status code). `details` are **allowlist-redacted** at the producer with
a secret-pattern backstop, so secrets/PII never reach the log. Events carry
RFC 9562 **uuidv7** ids (time-ordered, index-friendly).

### Surfacing & RBAC

`GET /events` (filters: tenantId, actorId, actorRole, action, entityType,
entityId, from, to, free-text `q`; cursor paging), `GET /events/:id`
(+ hash-chain proof), `GET /events/verify` (chain integrity), and
`GET /export?format=csv|json|ndjson` (streamed, constant memory). The
web admin console (platform/district/school) injects scope **server-side**
in the BFF so a client cannot widen its view:

| Action | platform | district | school |
|---|---|---|---|
| View global | ✅ | ❌ | ❌ |
| View district | ✅ | ✅ (own) | ❌ |
| View school | ✅ | ✅ (in district) | ✅ (own) |
| Export | ✅ | ✅ (own, ≤10k) | ✅ (own, ≤10k) |
| Hash-chain proof | ✅ | ✅ | ❌ |

### Retention

`audit_retention_policy` lives in tenant-svc settings: `min_days` (default
**2555** ≈ 7y FERPA), optional `max_days`. A nightly job archives events
older than `min_days` to cold object-lock storage, then detaches/drops the
aged partitions from the hot table.

## Delivered vs tracked

**Delivered (verified):** `@aivo/audit-client` (10 tests); audit-svc
hash-chain lib + append-only event store + `/events` query/proof/verify +
streaming export (7 tests; full suite 24/24); migration 0048; the
platform/district/school admin console (filter bar, table, detail drawer
with proof, export) + RBAC BFF + i18n (10 locales). tsc/eslint/route-audit
clean.

**Tracked for follow-up** (need a live Postgres/object-lock + cross-service
rollout): wiring `audit.emit`/`@audited` into every producer
(identity/admin/tenant/billing/data-governance/integration — the hook +
client are ready); the Drizzle-backed partitioned store + the nightly
retention/anchor job; the WORM anchor upload; the 1M-event p95<500ms and
100k-row<60s streaming performance runs (the query/stream/index design
targets them); and the live tamper-alert job (the `verify()` primitive that
flags the break already exists and is unit-tested).

The breach-investigation procedure is in
`docs/runbooks/audit-incident-response.md`.

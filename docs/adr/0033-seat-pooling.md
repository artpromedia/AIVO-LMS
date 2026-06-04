# 0033 — District seat pooling & billing rollups

- **Status:** Accepted
- **Date:** 2026-06-02
- **Deciders:** Platform Engineering, Billing Working Group
- **Related:** Sprint 4 district billing rollups,
  `services/billing-svc/src/domain/seats.ts`,
  `services/billing-svc/src/lib/audit.ts`, ADR 0018 (secrets management),
  ADR 0020 (single shell, multi-role identity).

## Context

AIVO is sold to districts, not to individual schools. A district signs a
single B2B contract for a contracted number of seats and expects **one
invoice** that rolls up usage across every school (child tenant) it owns.
The schools underneath the district are separate tenants in the identity
model — each has its own learners, staff, and `school_admin` — but they do
not each hold their own commercial relationship with us.

Until Sprint 4 the billing service modelled subscriptions per tenant only:
each tenant carried its own plan and its own Stripe subscription. That maps
poorly onto the district sales motion:

- **Revenue recognition (ASC 606).** The performance obligation is the
  district contract. Seats consumed by individual schools are deliveries
  against that single obligation, not separate contracts. Recognising
  revenue per child tenant would fragment one obligation into many and
  break the rollup our finance team reconciles against the order form.
- **Seat economics are pooled, not partitioned.** A district buys, say,
  5,000 seats and wants to hand 1,200 to one school and 800 to another,
  re-balancing across the year as enrolment shifts. Per-school independent
  licenses force a re-contract every time seats move and leave stranded,
  unused capacity locked to the wrong school.
- **Allocations change over time and in the future.** Districts plan the
  next term in advance: "as of the first day of the fall semester, move 300
  seats from School A to School C." The model must record _when_ an
  allocation takes effect, keep prior allocations for audit, and let
  finance answer "how many seats did School A hold on date D?".
- **Over-utilization must not break learning.** If a school's active-user
  count creeps above its allocation mid-term, blocking learners from the
  product is the wrong failure mode for an education customer. Finance
  still needs to know, so it can true-up or up-sell.
- **PSP credentials and invoice artifacts.** Stripe is the payment service
  provider. Its restricted key must never be read from `process.env` at
  runtime (ADR 0018), and rendered invoice PDFs are large, immutable
  documents that should not be re-fetched from Stripe on every district
  admin page load.

## Decision

We will introduce a **district-level seat pool with versioned, future-dated
allocations** in `services/billing-svc`, and roll all child-tenant usage up
to the district's single billing relationship.

### 1. Seat pool + allocations domain

The domain lives in `services/billing-svc/src/domain/seats.ts`:

- **`SeatPool { tenant_id, total, allocated, used, plan_id }`** — a pool of
  contracted seats owned by a **district** tenant. `total` is the
  contracted count, `allocated` is the sum of seats handed to child
  schools, `used` is the most recent measured utilization.
- **`SeatAllocation { from_tenant_id, to_tenant_id, count, effective_at }`**
  — a movement of `count` seats from one tenant to another (district → school,
  or school → school) that takes effect at `effective_at`.

Backed by four tables:

- `seat_pools` — one row per district pool (current materialised totals).
- `seat_allocations` — the current effective allocation per child tenant.
- `seat_allocation_history` — the append-only version log; every change
  writes a new row, nothing is updated in place.
- `invoices_cache` — denormalised invoice headers plus the object-storage
  key of the cached PDF (see §5).

### 2. The pool invariant

The core invariant is:

> **`sum(effective allocations out of a pool) <= pool.total`.**

An allocation request to a school is admissible only when its `count` fits
within `pool.total - sum(other schools' allocations effective at the same
instant)`. The check is enforced in the domain layer, inside the same
transaction that writes the allocation, so two concurrent allocation
requests cannot both pass against stale totals. `pool.allocated` is the
materialised left-hand side of the invariant.

A district may deliberately leave the pool under-allocated (hold seats in
reserve); the invariant only forbids over-allocation.

### 3. Versioned, future-dated allocations

Allocations are **never updated in place**. Every change appends a row to
`seat_allocation_history` with the new `count` and its `effective_at`. The
_effective_ allocation for a tenant at any instant is the most recent
history row whose `effective_at <= now`. This gives us:

- **Future-dating.** `effective_at` may be in the future; the row is
  written now but does not count toward the live invariant until its
  effective instant. The invariant in §2 is evaluated _per instant_, so a
  future-dated move is validated against the pool state at the moment it
  will take effect.
- **Point-in-time answers.** "How many seats did School A hold on date D?"
  is a single query against `seat_allocation_history`.
- **Audit.** The history table is the source of truth for who changed an
  allocation and when.

### 4. Overage is a non-blocking event; hard-cap is opt-in

The nightly utilization job (§6) measures `used` per child tenant from
`identity-svc` active users. When `used > allocated` for a tenant:

- We **do not block** usage. Learners keep working.
- We raise a **`billing.overage`** audit event via
  `services/billing-svc/src/lib/audit.ts` (the same hash-chained
  `audit_events` stream as the other `billing.*` events), carrying the
  tenant, the pool, `allocated`, and `used`. Finance reconciles overages
  into a true-up or up-sell.

A **configurable per-tenant hard-cap** is available as an opt-in for
districts that contractually require enforcement. When a hard-cap is set
and `used` would exceed it, seat acquisition for _new_ learners is refused
at that tenant; existing learners are never evicted. The hard-cap defaults
to **unset** (non-blocking) so the safe-for-learners behaviour is the
default.

### 5. PSP credentials in vault; invoice PDFs cached behind signed URLs

- The Stripe restricted key is read through the `SecretsClient`
  abstraction (ADR 0018), from vault in production — **never from an env
  var at runtime**. Billing-svc retrieves the key at the point of use, not
  at boot into a long-lived global.
- Billing-svc reports **metered usage** to Stripe and retrieves invoices
  from it. Retrieved invoice headers are denormalised into `invoices_cache`
  and the rendered **PDF is cached in object storage**. District admins are
  served a **short-lived signed URL** to the cached PDF rather than a live
  Stripe call on every page load. The cache is keyed by Stripe invoice id;
  a `billing.invoice.*` webhook invalidates and refreshes the cached row.

### 6. Nightly utilization rollup

A nightly job (alongside the existing
`services/billing-svc/src/routes/daily-jobs.ts` family) aggregates active
users per child tenant from `identity-svc`, rolls them up to the district
pool, writes `pool.used` / per-tenant `used`, and emits a `billing.overage`
event for any tenant over its allocation. The job is idempotent per day so a
re-run cannot double-count.

### 7. RBAC

Seat operations key off the **active role** (ADR 0020 §4):

- **`platform_admin`** — global; any pool, any district.
- **`district_admin`** — read and allocate within their own district's
  pool; this is the role that moves seats between schools.
- **`school_admin`** — read their own school's allocation and utilization,
  and **request** more seats (a request to the district admin, not a
  self-service grant). Plan changes and hard-cap changes require **step-up
  MFA**, consistent with the admin step-up policy.

## Consequences

**Positive**

- One district contract maps to one billing rollup, matching the ASC 606
  performance obligation our finance team reconciles against.
- Seats move between schools without re-contracting; stranded capacity is
  eliminated because the pool, not the school, owns the seats.
- Future-dated, append-only allocations give finance and auditors exact
  point-in-time answers and a tamper-evident change log.
- Over-utilization never blocks a learner by default, which is the correct
  failure mode for an education product, while still surfacing revenue
  signal to finance.
- Invoice PDFs render instantly from object storage; Stripe is not in the
  hot path of a district admin's billing page.

**Negative / risks**

- The pool invariant must be enforced transactionally; a naive
  read-modify-write would allow two concurrent allocations to over-commit a
  pool. The domain layer owns the check inside the writing transaction, and
  this is the highest-risk piece to get wrong.
- `invoices_cache` can drift from Stripe if a webhook is missed. The
  nightly job re-reconciles cached headers against Stripe to bound drift,
  and `billing.reconciliation.drift` events flag mismatches.
- Future-dated allocations mean the "current" allocation is a function of
  the clock, not a stored scalar; every consumer must read the effective
  allocation through the domain helper rather than trusting a single
  column.

**Neutral / follow-ups**

- Cross-district seat transfers (M&A, district re-org) are out of scope;
  the model assumes a pool is owned by exactly one district.
- Proration of mid-term seat moves into Stripe line items is left to the
  metered-usage reporting layer and is not specified here.
- A district-admin UI for visualising the allocation history timeline is a
  separate front-end work item.

## Alternatives Considered

- **Per-school independent licenses.** Give each school its own plan and
  Stripe subscription. Rejected: it fragments the single ASC 606
  performance obligation into many, forces a re-contract every time seats
  move between schools, and strands unused capacity on the wrong school.
- **Hard-blocking overage for everyone.** Refuse seat acquisition the
  instant `used > allocated`. Rejected as the default: blocking learners
  from an education product over a billing threshold is the wrong failure
  mode. Retained only as the **opt-in per-tenant hard-cap** for districts
  that contractually require it.
- **Mutable allocations (update-in-place).** Store one allocation row per
  school and overwrite `count` on change. Rejected: it loses the history
  finance and auditors need, makes future-dating impossible, and cannot
  answer point-in-time questions.
- **Computing "current allocation" by summing every history row.** Treat
  allocations as deltas and sum the log on every read. Rejected for the hot
  path: it is O(history) per read; instead `seat_pools`/`seat_allocations`
  materialise the current state and `seat_allocation_history` is the
  append-only audit log behind it.
- **Stripe key in `process.env`; invoice fetched live per request.**
  Rejected: violates ADR 0018 (no PSP credentials in env at runtime) and
  puts a third-party network call in the hot path of every billing page
  view.

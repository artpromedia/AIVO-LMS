# Runbook — Billing Disputes & Invoice Reconciliation

**Audience:** Billing on-call · Platform on-call · **Severity:** P2
(P1 if a chargeback threatens the Stripe account standing) ·
**Last reviewed:** Sprint 4

Use this when a district contests a billing outcome: a disputed invoice
amount, a Stripe chargeback/dispute webhook, a seat-count discrepancy, or
an overage charge a district says it never incurred. The goal is to
reconcile what we billed against what we measured, correct the record where
we were wrong, and issue a credit or defend the charge — leaving an audit
trail either way.

The seat-pooling model this runbook reconciles against is described in
ADR 0033 (`docs/adr/0033-seat-pooling.md`): a district owns a `seat_pool`,
allocations are versioned and future-dated, and over-utilization raises a
non-blocking `billing.overage` event rather than blocking learners.

## Symptoms / triggers

- A district admin emails or files a support ticket disputing an **invoice
  amount** ("we were billed for 5,000 seats, we only have 4,200").
- A **Stripe `charge.dispute.created` webhook** lands
  (`services/billing-svc/src/routes/webhooks.ts`) — a customer-initiated
  chargeback. This is time-boxed; treat as P1.
- A **seat-count discrepancy**: the seats on the invoice don't match the
  district's understanding of what each school holds.
- A district **contests an overage charge** — they say `used` never
  exceeded `allocated`, or that an overage was rolled into the invoice
  without notice.
- Finance flags a `billing.reconciliation.drift` event from the nightly
  job during month-end close.

## Pre-conditions

- You can read the billing database (`invoices_cache`, `seat_pools`,
  `seat_allocations`, `seat_allocation_history`) as a read-only operator.
- You have access to the Stripe Dashboard for the production account.
- For any credit or allocation correction you hold `platform_admin` (or are
  pairing with someone who does); these mutations require step-up MFA.
- The disputing tenant's `tenant_id` (district) and the contested invoice
  id / Stripe invoice id are in hand.

## Diagnose

Work top-down: establish _what we billed_, then _what we measured_, then
_why they differ_.

### 1. What we billed — `invoices_cache` + Stripe

Pull the cached invoice header and compare it to Stripe (the cache can lag
if a webhook was missed):

```sql
SELECT stripe_invoice_id, tenant_id, amount_due, seat_count,
       overage_amount, status, period_start, period_end, pdf_object_key
  FROM invoices_cache
 WHERE tenant_id = '<district_tenant_id>'
 ORDER BY period_start DESC
 LIMIT 6;
```

Then open the same invoice in the **Stripe Dashboard** and confirm the line
items, the metered-usage records reported for the period, and the amount.
If `invoices_cache.amount_due` and Stripe disagree, the cache is stale —
re-sync it (see Resolution) and re-read; do not reason off a stale cache.

### 2. What we measured — seat allocations & utilization

Reconstruct the allocation the district actually held during the billed
period. Because allocations are versioned and future-dated (ADR 0033 §3),
read the **history**, not just the current row:

```sql
SELECT to_tenant_id, count, effective_at, created_at
  FROM seat_allocation_history
 WHERE to_tenant_id IN (SELECT tenant_id FROM tenants
                         WHERE parent_tenant_id = '<district_tenant_id>')
   AND effective_at <= '<period_end>'
 ORDER BY to_tenant_id, effective_at;
```

The effective allocation for each school during the period is the most
recent history row whose `effective_at <= period_end`. Sum those to get the
district's allocated total; compare against `seat_pools.total` and the
`seat_count` on the invoice:

```sql
SELECT tenant_id, total, allocated, used, plan_id
  FROM seat_pools
 WHERE tenant_id = '<district_tenant_id>';
```

### 3. Why they differ — overage events & the nightly job

If the invoice carries an `overage_amount`, find the event(s) that produced
it. Overages are non-blocking `billing.overage` events in the hash-chained
`audit_events` stream (`services/billing-svc/src/lib/audit.ts`):

```sql
SELECT created_at, tenant_id, event_type, payload
  FROM audit_events
 WHERE tenant_id = '<district_tenant_id>'
   AND event_type LIKE 'billing.%'
   AND created_at BETWEEN '<period_start>' AND '<period_end>'
 ORDER BY created_at;
```

Look for `billing.overage` (the contested charge), `billing.plan.changed`
(a mid-period plan change can move the price), and
`billing.reconciliation.drift` (the nightly job already noticed a
mismatch). Each `billing.overage` payload carries the tenant, pool,
`allocated`, and `used` at the time it fired.

Cross-check `used` against the **nightly utilization job** output, which
aggregates active users from `identity-svc` and rolls them up to the pool.
If the district claims `used` never exceeded `allocated`, confirm whether
the job counted users it should not have (deactivated accounts, duplicate
identities) — a job-side miscount is a _we were wrong_ path, a genuine
over-utilization is a _defend the charge_ path.

### 4. Hard-cap check

If the district is on an opt-in **hard-cap** (ADR 0033 §4), confirm whether
the cap was hit during the period — a hard-cap refuses _new_ seat
acquisition but never evicts existing learners, so a district on a hard-cap
should generally **not** see an overage charge. An overage on a
hard-capped tenant is itself a bug to investigate, not just a dispute.

## Resolution

Pick the branch that matches the diagnosis.

### A. Cache was stale (we billed correctly, displayed wrong)

Re-sync the cached invoice from Stripe and re-serve the signed PDF URL:

```bash
pnpm --filter @aivo/billing-svc exec node scripts/resync-invoice.mjs \
  --stripe-invoice-id <id>
```

Confirm `invoices_cache` now matches Stripe, hand the district the
refreshed signed-URL PDF, and close the dispute as _display error, charge
correct_.

### B. We over-billed (seat count or overage wrong)

1. **Confirm the correct number** from `seat_allocation_history` (the
   allocation actually in effect) and the corrected utilization.
2. **Issue a credit** in Stripe for the difference (credit note against the
   disputed invoice — do not delete the invoice). Record the credit reason.
3. If the overage was produced by a job-side miscount, **re-run the
   nightly utilization job** for the affected period after fixing the
   counted set, so `pool.used` and future invoices are correct:
   ```bash
   pnpm --filter @aivo/billing-svc exec node scripts/run-utilization.mjs \
     --tenant <district_tenant_id> --date <YYYY-MM-DD>
   ```
4. The credit and re-run both emit `billing.*` audit events; verify they
   landed in `audit_events`.

### C. Allocation was wrong (seats recorded against the wrong school)

Do **not** edit `seat_allocation_history` rows in place — the table is
append-only (ADR 0033 §3). Write a **new** corrected allocation through the
district admin / platform path, dated to correct the record:

```bash
pnpm --filter @aivo/billing-svc exec node scripts/correct-allocation.mjs \
  --pool <district_tenant_id> --to <school_tenant_id> \
  --count <n> --effective-at <ISO8601>
```

The correction must satisfy the pool invariant
(`sum(allocations) <= pool.total`); the script rejects it otherwise. Then
re-run the utilization job (B.3) so downstream totals follow.

### D. Genuine over-utilization (we billed correctly)

The district really did exceed its allocation and the overage stands.
Respond with the evidence: the `billing.overage` event timestamps, the
`used` vs `allocated` numbers, and the nightly job output for the period.
Offer a true-up or a seat up-sell (raise `seat_pool.total` via a contract
change) rather than a credit.

### E. Stripe chargeback / dispute (P1)

A `charge.dispute.created` webhook is time-boxed by the card network.
Either **accept** the dispute (refund, if we agree we over-billed — see B)
or **submit evidence** in the Stripe Dashboard before the deadline. Use the
reconciliation from Diagnose §1–§3 as the evidence packet: cached invoice,
allocation history, overage events, utilization job output. Do not let a
dispute lapse past its deadline — that auto-loses it and dings account
standing.

## Verification

- The disputed invoice in `invoices_cache` matches Stripe and the
  reconciled seat math.
- Any credit issued appears in Stripe and a corresponding `billing.*` event
  appears in `audit_events`.
- Any allocation correction is a **new** `seat_allocation_history` row, the
  pool invariant still holds, and `seat_pools.allocated` reflects it.
- A re-run nightly job produces no new `billing.overage` for a period we
  credited as a miscount.

## Escalation

- **Seat math / allocation correctness** → Billing Working Group.
- **Stripe account standing, chargeback strategy, refunds above the
  on-call limit** → Finance + Platform Engineering lead.
- **Suspected PSP credential or webhook-signature problem** (missed
  webhooks, signature failures) → SecOps; see ADR 0018 (secrets) and the
  secret-rotation runbook. PSP credentials are vault-held and never in env
  at runtime — do not work around a webhook failure by hardcoding a key.
- **Repeated `billing.reconciliation.drift`** at close → file a postmortem;
  drift at scale means the cache or the nightly rollup has a systemic bug,
  not a one-off dispute.

## References

- ADR 0033 — district seat pooling & billing rollups
  (`docs/adr/0033-seat-pooling.md`).
- ADR 0018 — secrets management (PSP credentials in vault).
- `services/billing-svc/src/lib/audit.ts` — `billing.*` event emitter and
  the `audit_events` hash-chained stream.
- `services/billing-svc/src/routes/webhooks.ts` — Stripe webhook intake.
- `services/billing-svc/src/routes/daily-jobs.ts` — nightly job family.

# Billing + entitlements contract (Sprint 11)

This document is the source of truth for plans, entitlements, billing
states, coupons, family plans, district purchasing, and webhook
idempotency. It is paired with:

- `packages/billing-entitlements` — single shared evaluator
  (`evaluateTutorEntitlement`, `computeEffectiveTutorSkus`,
  `isTutorIncludedInPlan`)
- `services/billing-svc` — Stripe integration, webhook handler,
  coupon engine, plan/add-on routes
- `apps/web-v2/app/api/bff/billing/*` and
  `apps/web-v2/app/api/bff/parent/subscription/*` — UI BFFs
- `apps/web-v2/app/api/bff/admin/billing/*` — admin BFF
- `docs/billing-stripe-runbook.md` — operational runbook
- `scripts/billing-audit.mjs` (root script `billing:audit`)

## Plans

Defined in `packages/billing-entitlements::PlanId`:

| Plan       | Audience                    | Notes                                                   |
| ---------- | --------------------------- | ------------------------------------------------------- |
| `free`     | new account before checkout | gates everything except marketing-facing learners trial |
| `single`   | one learner family plan     | monthly or annual                                       |
| `family`   | multi-learner family plan   | up to N learners; check current pricing page            |
| `district` | enterprise PO-billed        | seat-based; provisioned by admin-svc                    |

Plan-to-included-SKUs is in `getIncludedTutorSkusForPlan(plan)`. The
add-on SKUs (`ADDON_TUTOR_*`) extend a plan with extra tutors. No
hard-coded plan IDs anywhere except `packages/billing-entitlements` —
all other code must reach through the package.

## Subscription states

Defined in `packages/billing-entitlements::SubscriptionStatus`. These
are Stripe's states plus our normalized `inactive`:

```
trialing → active → past_due → unpaid → canceled
                      ↓
                   incomplete → incomplete_expired
```

`isSubscriptionActive(status, policy)` is the canonical predicate.
`policy: "allow" | "deny"` controls past_due behavior; default
`"allow"` keeps the learner unlocked during Stripe's automatic retry
window so a single transient decline doesn't lock the shelf.

## Tutor add-ons

Lifecycle (`TutorSubscriptionStatus`):

```
active → grace_period → canceled → inactive
```

`evaluateTutorEntitlement` returns one of:

| reason                  | entitled | UI affordance                              |
| ----------------------- | -------- | ------------------------------------------ |
| `included`              | true     | tutor enabled                              |
| `purchased`             | true     | tutor enabled (add-on)                     |
| `grace_period`          | true     | "your add-on will expire on {date}" banner |
| `not_entitled`          | false    | "purchase add-on" CTA                      |
| `subscription_inactive` | false    | "renew subscription" CTA                   |

Anything that gates a tutor MUST call `evaluateTutorEntitlement` —
never check `subscription.plan` directly. The audit script
enforces this on the web-v2 BFF.

## Coupons

`services/billing-svc/src/routes/coupons.ts` exposes:

| Method   | Path                               | Audience                               |
| -------- | ---------------------------------- | -------------------------------------- |
| `POST`   | `/api/billing/coupons/validate`    | parent / staff — quote, no redemption  |
| `POST`   | `/api/billing/coupons/redeem`      | parent / staff — single-use redemption |
| `GET`    | `/api/billing/admin/coupons`       | admin                                  |
| `POST`   | `/api/billing/admin/coupons`       | admin                                  |
| `DELETE` | `/api/billing/admin/coupons/:code` | admin                                  |

Coupon kinds:

- **Discount** — percent or fixed-amount off; redemption tied to
  `subscription.id`; audit event `billing.coupon.redeemed`.
- **Provisioning** — grants entitlement without payment (e.g. school
  pilot access code); single-use per tenant; auto-expires.
- **School pilot access code** — provisions a `district` plan slice
  with seat cap; manual admin activation required for go-live.

Every redemption emits `billing.coupon.redeemed`; rejections emit
`billing.coupon.rejected` with a reason.

## Stripe checkout / portal

| Action                | Endpoint                                          |
| --------------------- | ------------------------------------------------- |
| Start Stripe Checkout | `POST /api/billing/checkout/session`              |
| Open customer portal  | `POST /api/billing/portal/session`                |
| Cancel at period end  | `POST /api/billing/subscription/:tenantId/cancel` |
| Resume / undo cancel  | `POST /api/billing/subscription/:tenantId/resume` |
| Add tutor add-on      | `POST /api/billing/addons`                        |
| Remove tutor add-on   | `DELETE /api/billing/addons/:tenantId/:tutorId`   |
| Read entitlements     | `GET /api/billing/entitlements/:tenantId`         |
| Read usage            | `GET /api/billing/usage/:tenantId`                |
| Read invoices         | `GET /api/billing/invoices/:tenantId`             |

`lib/stripe.ts` uses Stripe idempotency keys on every mutating call
(`idempotencyKey: "checkout:plan:<tenant>:<plan>:<user>"`,
`"addon:add:<sub>:<sku>"`, etc.) so retries from a poor connection
never double-charge.

## Webhook idempotency

`services/billing-svc/src/routes/webhooks.ts` POST handler:

1. Verifies Stripe signature.
2. Inserts the event into `stripe_webhook_events` keyed by `event.id`.
   `ON CONFLICT DO NOTHING` — duplicates are a no-op.
3. Dispatches to a per-event handler that is itself idempotent
   (e.g. updating subscription state with a `WHERE updated_at < event.created`
   guard).

The audit script enforces that the webhook route stays wired to the
event log table; do not regress to in-memory dedup.

## District / school purchasing

Sprint 12 wires the rostering side. For billing-svc the contract is:

- `district` plan is provisioned out-of-band by an admin (PO workflow
  in admin-svc), not via Stripe Checkout.
- Seats are allocated in `admin-svc::tenant_seats`; consumed by
  rostering imports.
- Cancellation drops to `grace_period` for 30 days, then `inactive`.
- Re-activation restores prior seat allocation.

## Audit script

`scripts/billing-audit.mjs` (`billing:audit`):

1. `packages/billing-entitlements` exports `evaluateTutorEntitlement`,
   `computeEffectiveTutorSkus`, `isTutorIncludedInPlan`, `PlanId`,
   `TutorSubscriptionStatus`, `SubscriptionStatus`.
2. Every BFF route under `apps/web-v2/app/api/bff/billing/**` and
   `apps/web-v2/app/api/bff/parent/subscription/**` and any
   `apps/web-v2/app/api/bff/admin/billing/**` that gates on a tutor
   either reaches `evaluateTutorEntitlement` (directly or via an
   imported helper) OR is listed in the audit's allow-list (admin
   read-only routes that don't gate).
3. `services/billing-svc/src/routes/webhooks.ts` retains the
   `stripe_webhook_events` idempotency insert.
4. `services/billing-svc/src/lib/stripe.ts` retains `idempotencyKey`
   on every mutating Stripe call.

## Verification

```bash
pnpm billing:audit
pnpm --filter @aivo/billing-entitlements test
pnpm --filter @aivo/billing-svc test
pnpm test:enterprise   # district seat allocation, coupon redemption
```

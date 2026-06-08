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

> **Source of truth.** `billing-svc` and its `billing_coupons` table are the
> single canonical store for every coupon. Admin surfaces do **not** keep a
> separate coupon model — they are read-through projections of billing-svc.
> The web-v2 in-memory `Coupon` type (`apps/web-v2/lib/db/types.ts`) is a
> deprecated demo-only fixture for the offline/mock UI and is never seeded
> outside development; production coupon data always comes from billing-svc.

**Admin path (web-admin → admin-svc → billing-svc).** The platform-admin
coupon UI lives in `apps/web-admin` (`/platform/billing/coupons`). It uses the
`@aivo/admin-api/billing` client (`listCoupons` / `createCoupon` /
`disableCoupon`), which calls admin-svc's proxy
(`/api/admin-svc/billing/coupons[/:code]`, see
`services/admin-svc/src/routes/billing-coupons.ts`). admin-svc forwards the
caller's platform-admin Bearer to billing-svc and passes the canonical error
codes through verbatim; the client maps them to friendly copy
(`COUPON_ERROR_MESSAGES`). Both hops require `PLATFORM_ADMIN`, so non-platform
roles get 403 at admin-svc and again at billing-svc.

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
  with seat cap. **No manual activation:** the platform-admin "Provision
  pilot" flow mints AND redeems this PROVISIONING coupon for the new district
  tenant automatically (see below), so a district is born with its entitlement.

### Automated pilot provisioning (no manual coupon step)

`POST /api/billing/internal/pilots/provision` (service-to-service, guarded by
the internal `x-service-token`) is the entitlement half of the platform-admin
"Provision pilot" flow (identity-svc `POST /api/admin/pilots`). In one
transaction it mints a single-use `PROVISIONING` coupon (`PILOT-<tenantShort>`
when no code is supplied) and redeems it **for the new district tenant** —
setting `tenants.licensing_tier` + `seat_limit` and inserting the `ACTIVE`
`subscriptions` row via the shared `provisionTenantEntitlement` (the same
money/seat write the parent coupon-redeem path uses). It is **idempotent on
`(tenantId, couponCode)`**: a re-run that finds the tenant already entitled by
this coupon returns the existing entitlement (`provisioned: false`) without
touching seats or the redemption counter again.

The admin detail route `GET /api/billing/admin/coupons/:code` returns the
single coupon row with its live redemption count (for the pilot-uptake view).

### Coupon audit + metrics

Audit events (hash-chained `audit_events`, surfaced in admin audit dashboards):

| Event                       | Emitted when                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `billing.coupon.created`    | admin creates a coupon (actor + type + grants)                                                                |
| `billing.coupon.disabled`   | admin disables a coupon                                                                                       |
| `billing.coupon.redeemed`   | a coupon is redeemed (DISCOUNT/SUBSCRIPTION/PROVISIONING)                                                     |
| `billing.pilot.provisioned` | a district pilot entitlement is provisioned (seat cap + active subscription) via the internal provision route |

Prometheus counters (`/metrics`):

| Counter                          | Labels | Incremented on        |
| -------------------------------- | ------ | --------------------- |
| `billing_coupons_created_total`  | `type` | successful create     |
| `billing_coupons_redeemed_total` | `type` | successful redemption |

`type` is the `coupon_type` (`DISCOUNT` / `SUBSCRIPTION` / `PROVISIONING`).

## Trials

- **Trial-ending reminders.** The scheduled job
  `billing.daily-trial-ending-reminders`
  (`services/billing-svc/src/lib/trialEndingReminderService.ts`) finds
  subscriptions with `status = TRIALING` whose `trial_ends_at` is within 3
  days and dispatches the comms-svc `trial_ending` template (email + in-app).
  Exactly-once is guaranteed by the `subscriptions.trial_ending_reminder_sent_at`
  latch — the row is skipped once notified, and the latch is set only after a
  successful send (a transient comms failure retries next tick). This is
  distinct from `trial_will_end_notified_at`, which only records the Stripe
  `customer.subscription.trial_will_end` event.
- **Attribution.** Subscriptions created from a coupon (coupon redeem) or a
  `?plan=…&coupon=…&utm_…` signup link carry `couponCode` + `utm_*` on
  `subscriptions.metadata` (`lib/attribution.ts` `pickAttribution`; threaded
  through Stripe checkout metadata and persisted on the webhook subscription
  insert). This is the basis for pilots-started → pilots-converted reporting.
- **Conversion report.** `GET /api/admin-svc/billing/trials/conversion`
  (BillingRead) returns trials started (30d), trialing now, trials ending in 7
  days, trial→paid conversion rate, and pilot-coupon conversion (computed by
  `admin-svc/src/lib/trial-conversion.ts`). Surfaced at web-admin
  `/platform/billing/trials`.

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

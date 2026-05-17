-- Sprint: Production Stripe billing.
--
-- 1. Add the columns the billing service needs to treat the DB as the
--    source of truth for subscription state (Stripe customer id, price id,
--    cancel-at-period-end, period start, canceled_at, trial end, status
--    mirrored from Stripe, and payment status for retry handling).
-- 2. Create `invoices` to persist Stripe invoices so the customer-facing
--    list survives reload and the daily reconciliation job can repair
--    stale rows.
-- 3. Create `stripe_webhook_events` for webhook idempotency so duplicate
--    or replayed events are acknowledged without re-mutating state.
-- 4. Add a unique index on `tutor_subscriptions(user_id, tutor_sku)` so
--    the existing reactivation flow can't race itself into two active
--    rows for the same tutor.
--
-- All statements use IF NOT EXISTS so the migration is safe to re-run.

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" varchar(255),
  ADD COLUMN IF NOT EXISTS "stripe_price_id" varchar(255),
  ADD COLUMN IF NOT EXISTS "stripe_status" varchar(32),
  ADD COLUMN IF NOT EXISTS "payment_status" varchar(32),
  ADD COLUMN IF NOT EXISTS "cancel_at_period_end" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "current_period_start" timestamp,
  ADD COLUMN IF NOT EXISTS "canceled_at" timestamp,
  ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp;

CREATE INDEX IF NOT EXISTS "subscriptions_tenant_idx"
  ON "subscriptions" ("tenant_id");

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripe_sub_unique"
  ON "subscriptions" ("stripe_subscription_id")
  WHERE "stripe_subscription_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "tutor_subs_user_idx"
  ON "tutor_subscriptions" ("user_id");

-- Dedup before creating the partial unique index. Pre-migration there
-- was no DB-level guarantee against duplicate active rows for the same
-- (user, tutor); the route code guarded against it but a race or a
-- service-token caller could still slip one through. We keep the
-- freshest row active (by activated_at desc) and soft-cancel older
-- duplicates so historical evidence survives.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, tutor_sku
      ORDER BY activated_at DESC, id DESC
    ) AS rn
  FROM tutor_subscriptions
  WHERE status IN ('active', 'grace_period')
)
UPDATE tutor_subscriptions
   SET status = 'canceled',
       deactivated_at = COALESCE(deactivated_at, now())
 WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Partial unique: at most one active/grace_period entitlement per
-- (user, tutor). Canceled rows can repeat freely so audit history is
-- preserved.
CREATE UNIQUE INDEX IF NOT EXISTS "tutor_subs_user_sku_unique"
  ON "tutor_subscriptions" ("user_id", "tutor_sku")
  WHERE status IN ('active', 'grace_period');

CREATE TABLE IF NOT EXISTS "invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "stripe_invoice_id" varchar(255) NOT NULL,
  "stripe_customer_id" varchar(255),
  "stripe_subscription_id" varchar(255),
  "number" varchar(64),
  "status" varchar(32) NOT NULL,
  "amount_due" integer NOT NULL DEFAULT 0,
  "amount_paid" integer NOT NULL DEFAULT 0,
  "currency" varchar(8) NOT NULL DEFAULT 'usd',
  "hosted_invoice_url" text,
  "invoice_pdf" text,
  "period_start" timestamp,
  "period_end" timestamp,
  "paid_at" timestamp,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "invoices_tenant_idx"
  ON "invoices" ("tenant_id");

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_stripe_id_unique"
  ON "invoices" ("stripe_invoice_id");

CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
  "id" varchar(255) PRIMARY KEY,
  "type" varchar(128) NOT NULL,
  "received_at" timestamp NOT NULL DEFAULT now(),
  "processed_at" timestamp,
  "error" text
);

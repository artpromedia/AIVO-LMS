-- 0033_billing_plan_metadata_columns
--
-- Restores the `plan` and `metadata` columns on `subscriptions` that the
-- Drizzle schema (packages/db/src/schema/billing.ts) selects from but that
-- had drifted out of the production schema. Without these columns every
-- `SELECT *` on subscriptions throws, breaking both billing-svc
-- `/api/billing/entitlements/:tenantId` and tutor-svc
-- `/api/tutor/session/start` (which loads the tenant's subscription to
-- gate tutor entitlements).
--
-- `plan` is backfilled from the legacy `plan_id` column so existing rows
-- resolve a sensible PlanId; new writes will populate it via Drizzle.

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan varchar(100);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

UPDATE subscriptions
   SET plan = plan_id
 WHERE plan IS NULL
   AND plan_id IS NOT NULL;

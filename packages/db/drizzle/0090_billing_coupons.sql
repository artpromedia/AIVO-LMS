-- 0090_billing_coupons.sql
--
-- District-pilot pack, Sprint 4 hardening: canonical migration for the coupon
-- engine source-of-truth table, replacing the defensive
-- `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE … ADD COLUMN` bootstrap that used
-- to live in services/billing-svc/src/routes/coupons.ts. Also adds the durable,
-- multi-replica-safe rate-limit table backing the redeem token bucket.
--
-- Idempotent: dev DBs that already created billing_coupons via the old in-route
-- DDL are backfilled in place (ADD COLUMN IF NOT EXISTS), and the migrator's
-- __drizzle_migrations ledger keeps re-runs safe.
CREATE TABLE IF NOT EXISTS "billing_coupons" (
	"code" varchar(64) PRIMARY KEY NOT NULL,
	"description" text,
	"discount_pct" integer DEFAULT 0 NOT NULL,
	"max_redemptions" integer,
	"redemptions" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"coupon_type" varchar(20) DEFAULT 'DISCOUNT' NOT NULL,
	"grants_tier" varchar(30),
	"grants_plan" varchar(50),
	"grants_seat_limit" integer,
	"grants_duration_days" integer
);
--> statement-breakpoint
ALTER TABLE "billing_coupons" ADD COLUMN IF NOT EXISTS "coupon_type" varchar(20) DEFAULT 'DISCOUNT' NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_coupons" ADD COLUMN IF NOT EXISTS "grants_tier" varchar(30);--> statement-breakpoint
ALTER TABLE "billing_coupons" ADD COLUMN IF NOT EXISTS "grants_plan" varchar(50);--> statement-breakpoint
ALTER TABLE "billing_coupons" ADD COLUMN IF NOT EXISTS "grants_seat_limit" integer;--> statement-breakpoint
ALTER TABLE "billing_coupons" ADD COLUMN IF NOT EXISTS "grants_duration_days" integer;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_rate_limits" (
	"scope" varchar(64) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_rate_limits_pk" ON "billing_rate_limits" USING btree ("scope","subject");

-- 0081_web_billing.sql
--
-- Sprint 2 (persistence migration): durable, web-owned billing / AI-cost
-- tables. ADR 0015 — the canonical subscription/invoice/seat state stays in
-- services/billing-svc (read over REST); these hold web-v2's OWN operational
-- rows that previously lived in the in-memory Map (real money/quota data lost
-- on restart): billing-account snapshots, AI spend budgets + the per-request
-- cost ledger, the admin coupon catalog, and the nightly batch run log.
--
-- Mirrors the web-domain pattern (id/tenant_id/data jsonb, 0049).
--
-- RLS: intentionally NOT applied. Although billing accounts / AI budgets /
-- cost events carry a tenant_id, they are read by PLATFORM-ADMIN flows that
-- scan ACROSS tenants (the admin billing + AI-budget consoles, cross-tenant
-- cost roll-ups). That is the same reason 0050 leaves web_users /
-- web_memberships / web_audit_logs unprotected — a per-connection
-- app.current_tenant policy would filter out exactly the cross-tenant rows
-- these admin surfaces need. Tenant scoping is enforced in app code via the
-- indexed tenant_id columns. Coupons + daily batches are platform-wide.
--
-- Grants: 0050's ALTER DEFAULT PRIVILEGES already grants the aivo_app role
-- SELECT/INSERT/UPDATE/DELETE on every table the owner creates afterwards, so
-- no explicit GRANT is needed here.
--
-- See packages/db/src/schema/web-billing.ts for the drizzle definitions.

CREATE TABLE IF NOT EXISTS "web_billing_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "created_at" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_billing_accounts_tenant_idx"
  ON "web_billing_accounts" ("tenant_id", "created_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_ai_budgets" (
  "tenant_id" text PRIMARY KEY NOT NULL,
  "updated_at" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_ai_cost_events" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "occurred_at" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_ai_cost_events_tenant_idx"
  ON "web_ai_cost_events" ("tenant_id", "occurred_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_coupons" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "created_at" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_coupons_code_idx" ON "web_coupons" ("code");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_daily_billing_batches" (
  "id" text PRIMARY KEY NOT NULL,
  "run_date" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_daily_billing_batches_date_idx"
  ON "web_daily_billing_batches" ("run_date");

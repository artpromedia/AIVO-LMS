-- Sprint 4 — District-level seat pooling, allocations, and invoice cache.
--
-- `seat_pools`: one pool per parent tenant (district); `total` contracted
-- seats, `allocated` materialized sum of effective child allocations, `used`
-- from the nightly utilization job, optional per-tenant `hard_cap`.
-- `seat_allocations`: immutable log of moves; `from_tenant_id` NULL = grant
-- from the unallocated remainder; `effective_at` may be future-dated.
-- `seat_allocation_history`: versioned audit of every allocation change.
-- `invoices_cache`: district-rollup cache of Stripe invoices with the
-- object-storage key + signed-URL expiry for the cached PDF.
-- See ADR 0033 and services/billing-svc/src/domain/seats.ts.

CREATE TABLE IF NOT EXISTS "seat_pools" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants" ("id"),
  "plan_id" varchar(100) NOT NULL,
  "total" integer DEFAULT 0 NOT NULL,
  "allocated" integer DEFAULT 0 NOT NULL,
  "used" integer DEFAULT 0 NOT NULL,
  "hard_cap" integer,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "seat_pools_tenant_unique" ON "seat_pools" ("tenant_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "seat_allocations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pool_id" uuid NOT NULL REFERENCES "seat_pools" ("id"),
  "from_tenant_id" uuid REFERENCES "tenants" ("id"),
  "to_tenant_id" uuid NOT NULL REFERENCES "tenants" ("id"),
  "count" integer NOT NULL,
  "effective_at" timestamp NOT NULL,
  "status" varchar(24) DEFAULT 'pending' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "superseded_by" uuid,
  "created_by" uuid REFERENCES "users" ("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "seat_allocations_pool_idx" ON "seat_allocations" ("pool_id");
CREATE INDEX IF NOT EXISTS "seat_allocations_to_idx" ON "seat_allocations" ("to_tenant_id");
CREATE INDEX IF NOT EXISTS "seat_allocations_effective_idx" ON "seat_allocations" ("effective_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "seat_allocation_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "allocation_id" uuid NOT NULL,
  "pool_id" uuid NOT NULL,
  "action" varchar(24) NOT NULL,
  "from_tenant_id" uuid,
  "to_tenant_id" uuid NOT NULL,
  "count" integer NOT NULL,
  "effective_at" timestamp NOT NULL,
  "version" integer NOT NULL,
  "actor_id" uuid,
  "details" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "seat_allocation_history_pool_idx" ON "seat_allocation_history" ("pool_id", "created_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "invoices_cache" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants" ("id"),
  "stripe_invoice_id" varchar(255) NOT NULL,
  "number" varchar(64),
  "status" varchar(32) NOT NULL,
  "amount_due" integer DEFAULT 0 NOT NULL,
  "amount_paid" integer DEFAULT 0 NOT NULL,
  "currency" varchar(8) DEFAULT 'usd' NOT NULL,
  "pdf_object_key" text,
  "pdf_signed_url_expires_at" timestamp,
  "hosted_invoice_url" text,
  "period_start" timestamp,
  "period_end" timestamp,
  "issued_at" timestamp,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "invoices_cache_tenant_idx" ON "invoices_cache" ("tenant_id", "issued_at");
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_cache_stripe_id_unique" ON "invoices_cache" ("stripe_invoice_id");

-- Responsible AI Console registry (Sprint 7).
--
-- Mirrors services/responsible-ai-svc/src/db/migrations/0001_responsible_ai_registry.sql.
-- Tables are rai_-prefixed to avoid collisions with other @aivo/db tables.
-- CHECK-constrained columns (modality/status/scope_level/harness/severity/
-- state) are validated in the application; kept as plain text here. Additive
-- only — CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "rai_models" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "modality" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "owner_team" TEXT NOT NULL,
  "owner_contact" TEXT NOT NULL,
  "intended_use" TEXT NOT NULL DEFAULT '',
  "out_of_scope_use" TEXT NOT NULL DEFAULT '',
  "current_version_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rai_models_status" ON "rai_models" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rai_models_modality" ON "rai_models" ("modality");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rai_model_versions" (
  "id" TEXT PRIMARY KEY,
  "model_id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "released_at" TIMESTAMPTZ NOT NULL,
  "changelog" TEXT NOT NULL DEFAULT '',
  "provenance_hash" TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_rai_model_versions_model_version" ON "rai_model_versions" ("model_id", "version");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rai_model_cards" (
  "model_id" TEXT PRIMARY KEY,
  "markdown" TEXT NOT NULL,
  "metadata" JSONB NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rai_policies" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "scope_level" TEXT NOT NULL,
  "scope_id" TEXT,
  "content_safety" JSONB NOT NULL,
  "age_gating" JSONB NOT NULL,
  "region_restrictions" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_by" TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rai_policies_scope" ON "rai_policies" ("scope_level", "scope_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rai_evals" (
  "id" TEXT PRIMARY KEY,
  "model_id" TEXT NOT NULL,
  "harness" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rai_eval_runs" (
  "id" TEXT PRIMARY KEY,
  "model_id" TEXT NOT NULL,
  "harness" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "metrics" JSONB,
  "cases" JSONB NOT NULL DEFAULT '[]',
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completed_at" TIMESTAMPTZ,
  "triggered_by" TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rai_eval_runs_model" ON "rai_eval_runs" ("model_id", "started_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rai_incidents" (
  "id" TEXT PRIMARY KEY,
  "model_id" TEXT,
  "tenant_id" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "reported_by" TEXT NOT NULL,
  "reported_by_role" TEXT NOT NULL,
  "timeline" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rai_incidents_tenant" ON "rai_incidents" ("tenant_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rai_optouts" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "model_id" TEXT,
  "feature" TEXT,
  "reason" TEXT NOT NULL DEFAULT '',
  "created_by" TEXT NOT NULL,
  "created_by_role" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rai_optouts_tenant" ON "rai_optouts" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rai_usage_aggregates" (
  "model_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "calls" BIGINT NOT NULL DEFAULT 0,
  "tokens" BIGINT NOT NULL DEFAULT 0,
  "cost_usd" NUMERIC(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY ("model_id", "tenant_id", "date")
);

-- 0087_web_support_settings.sql
--
-- Sprint 8 (persistence migration): web-owned support + settings. Support
-- tickets, the AI-generation job log, tenant settings, and the platform
-- settings catalogs (API keys, email templates, webhook endpoints).
--
-- NOT RLS-protected: support/AI-job admin consoles read across tenants, tenant
-- settings are tenant-keyed, platform settings are global. App-layer scoping;
-- aivo_app granted via 0050. See packages/db/src/schema/web-support-settings.ts.

CREATE TABLE IF NOT EXISTS "web_support_tickets" (
  "id" text PRIMARY KEY NOT NULL, "tenant_id" text NOT NULL, "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_support_tickets_tenant_idx" ON "web_support_tickets" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_ai_generation_jobs" (
  "id" text PRIMARY KEY NOT NULL, "tenant_id" text NOT NULL, "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_ai_generation_jobs_tenant_idx" ON "web_ai_generation_jobs" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_tenant_settings" (
  "tenant_id" text PRIMARY KEY NOT NULL, "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_platform_api_keys" (
  "id" text PRIMARY KEY NOT NULL, "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_platform_email_templates" (
  "id" text PRIMARY KEY NOT NULL, "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_platform_webhook_endpoints" (
  "id" text PRIMARY KEY NOT NULL, "data" jsonb NOT NULL
);

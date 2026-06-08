-- 0084_web_privacy.sql
--
-- Sprint 5 (persistence migration): durable privacy / DSAR / terms governance.
-- DSAR export & deletion requests are legal obligations with SLAs — they must
-- survive restarts. Extends the compliance domain (consent records / IEP docs
-- already in 0049) with the consent-version catalog, terms acceptances, data
-- inventory + retention policies, FERPA disclosure logs, DSAR export/deletion
-- requests, and IEP-document access logs.
--
-- NOT RLS-protected: these carry tenant_id but are read by PLATFORM/ADMIN
-- flows — the DPO console reviews the DSAR queue + disclosures across tenants,
-- and the disclosure + IEP-access logs are append-only audit trails. Same
-- exclusion 0050 makes for web_users / web_audit_logs. aivo_app is granted via
-- 0050's ALTER DEFAULT PRIVILEGES. See packages/db/src/schema/web-privacy.ts.

CREATE TABLE IF NOT EXISTS "web_consent_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_terms_acceptances" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_data_inventory" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_data_retention_policies" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_disclosure_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_disclosure_logs_tenant_idx"
  ON "web_disclosure_logs" ("tenant_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_data_export_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_data_deletion_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_iep_doc_access_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "learner_id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_iep_doc_access_logs_idx"
  ON "web_iep_doc_access_logs" ("tenant_id", "learner_id");

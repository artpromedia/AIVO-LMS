-- 0083_web_security.sql
--
-- Sprint 4 (persistence migration): durable, web-owned security / SOC 2 /
-- privacy-matrix compliance artifacts. Evidence and incident timelines are
-- compliance records — they cannot evaporate on restart.
--
-- PLATFORM-GLOBAL (no tenant_id — one security posture for the whole
-- platform), so NOT RLS-protected, the same exclusion 0050 makes for
-- web_policy_versions / web_subprocessors. Predicate columns exist only for
-- the foreign-key filters the stores use; sorts are applied in app code.
--
-- aivo_app is granted via 0050's ALTER DEFAULT PRIVILEGES (owner-created
-- tables). See packages/db/src/schema/web-security.ts.

CREATE TABLE IF NOT EXISTS "web_security_controls" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_control_evidence" (
  "id" text PRIMARY KEY NOT NULL,
  "control_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_control_evidence_control_idx"
  ON "web_control_evidence" ("control_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_risk_register" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_incidents" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_incident_timeline" (
  "id" text PRIMARY KEY NOT NULL,
  "incident_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_incident_timeline_incident_idx"
  ON "web_incident_timeline" ("incident_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_vendors" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_state_privacy_requirements" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_state_privacy_mappings" (
  "id" text PRIMARY KEY NOT NULL,
  "requirement_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_state_privacy_mappings_req_idx"
  ON "web_state_privacy_mappings" ("requirement_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_vulnerability_reports" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);

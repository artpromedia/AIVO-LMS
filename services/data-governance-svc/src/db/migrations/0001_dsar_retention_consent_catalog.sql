-- Sprint 5 — Compliance Console: DSAR, retention, consent ledger, data catalog.
--
-- dsar_requests: data-subject access requests (GDPR 15-22 / CCPA / FERPA) with
--   SLA deadlines (ack 72h, fulfillment 30d) and evidence artifacts.
-- dsar_events: append-only DSAR timeline.
-- retention_policies: per-data-class retention window + disposition, optionally
--   tenant-scoped (NULL tenant = platform default).
-- consents: consent ledger (COPPA verifiable parental consent, etc.).
-- data_catalog: data classes, owning service, sensitivity, default retention.
-- See ADR 0034 and services/data-governance-svc/src/domain/.

CREATE TABLE IF NOT EXISTS "dsar_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid,
  "type" varchar(24) NOT NULL,
  "regulation" varchar(16) DEFAULT 'gdpr' NOT NULL,
  "subject_id" uuid NOT NULL,
  "subject_type" varchar(24) DEFAULT 'learner' NOT NULL,
  "subject_email" text,
  "requester_id" uuid,
  "requester_role" varchar(40),
  "on_behalf_of_minor" boolean DEFAULT false NOT NULL,
  "status" varchar(32) DEFAULT 'intake' NOT NULL,
  "identity_verified" boolean DEFAULT false NOT NULL,
  "verification_method" varchar(40),
  "assignee_id" uuid,
  "evidence" jsonb DEFAULT '[]'::jsonb,
  "notes" text,
  "ack_due_at" timestamp,
  "fulfillment_due_at" timestamp,
  "acknowledged_at" timestamp,
  "fulfilled_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_dsar_requests_status" ON "dsar_requests" ("status");
CREATE INDEX IF NOT EXISTS "idx_dsar_requests_subject" ON "dsar_requests" ("subject_id");
CREATE INDEX IF NOT EXISTS "idx_dsar_requests_tenant" ON "dsar_requests" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_dsar_requests_fulfillment_due" ON "dsar_requests" ("fulfillment_due_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "dsar_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dsar_id" uuid NOT NULL,
  "event_type" varchar(40) NOT NULL,
  "actor_id" uuid,
  "actor_role" varchar(40),
  "detail" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_dsar_events_dsar" ON "dsar_events" ("dsar_id", "created_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "retention_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid,
  "data_class" varchar(80) NOT NULL,
  "retention_days" integer,
  "disposition" varchar(20) DEFAULT 'purge' NOT NULL,
  "legal_hold" boolean DEFAULT false NOT NULL,
  "updated_by_id" uuid,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_retention_policies_class_tenant" ON "retention_policies" ("data_class", "tenant_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "consents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid,
  "subject_id" uuid NOT NULL,
  "subject_type" varchar(24) DEFAULT 'learner' NOT NULL,
  "consent_type" varchar(80) NOT NULL,
  "granted" boolean NOT NULL,
  "actor_id" uuid,
  "actor_role" varchar(40),
  "method" varchar(40),
  "policy_version" varchar(40),
  "revoked_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_consents_subject" ON "consents" ("subject_id");
CREATE INDEX IF NOT EXISTS "idx_consents_tenant" ON "consents" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_consents_type" ON "consents" ("consent_type");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "data_catalog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "data_class" varchar(80) NOT NULL,
  "owning_service" varchar(60) NOT NULL,
  "sensitivity" varchar(20) NOT NULL,
  "description" text,
  "default_retention_days" integer,
  "erasable" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_data_catalog_class" ON "data_catalog" ("data_class");

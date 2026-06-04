-- Backfill migration for 28 tables added to packages/db/src/schema/
-- via 'drizzle-kit push' in dev but never authored as migrations.
-- All statements are IF NOT EXISTS-guarded so this is safe to apply
-- to production where these tables were created out-of-band as well
-- as to fresh CI databases where they do not yet exist.
--
-- Tracks: scripts/check-schema-drift.ts CI gate (Task #182).

DO $$ BEGIN
	CREATE TYPE "aac_word_kind" AS ENUM ('core', 'fringe');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "aac_vocabulary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"locale" varchar(16) DEFAULT 'en' NOT NULL,
	"label" varchar(128) NOT NULL,
	"symbol_key" varchar(128) NOT NULL,
	"kind" "aac_word_kind" DEFAULT 'fringe' NOT NULL,
	"grid_row" integer NOT NULL,
	"grid_col" integer NOT NULL,
	"background_color" varchar(16),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "problem_session_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"problem_session_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"response_json" jsonb DEFAULT '{}'::jsonb,
	"correct" boolean DEFAULT false,
	"score" real,
	"latency_ms" integer DEFAULT 0,
	"hint_count" integer DEFAULT 0,
	"eraser_count" integer DEFAULT 0,
	"tool_change_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "problem_session_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"problem_session_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"event_type" varchar(80) NOT NULL,
	"event_payload_json" jsonb DEFAULT '{}'::jsonb,
	"redacted_payload_json" jsonb DEFAULT '{}'::jsonb,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "problem_session_surface_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"problem_session_id" uuid NOT NULL,
	"surface_id" varchar(100) NOT NULL,
	"snapshot_type" varchar(30) NOT NULL,
	"snapshot_json" jsonb DEFAULT '{}'::jsonb,
	"storage_url" text,
	"stroke_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "problem_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"subject" varchar(100) NOT NULL,
	"skill_code" varchar(100),
	"standard_code" varchar(100),
	"source" varchar(50) NOT NULL,
	"source_session_id" uuid,
	"tutor_sku" varchar(100),
	"status" varchar(30) DEFAULT 'active' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"metadata_json" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "class_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "district_admin_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"district_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(40) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"external_id" varchar(120),
	"created_at" timestamp DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_districts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"external_id" varchar(120),
	"created_at" timestamp DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"district_id" uuid NOT NULL,
	"name" text NOT NULL,
	"external_id" varchar(120),
	"created_at" timestamp DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teacher_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"teacher_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_lti_launches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid,
	"learner_id" uuid,
	"context_id" text,
	"resource_link_id" text,
	"status" varchar(30) DEFAULT 'validated' NOT NULL,
	"issues_json" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_lti_tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"district_id" uuid,
	"issuer" text NOT NULL,
	"client_id" text NOT NULL,
	"deployment_id" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_sis_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"district_id" uuid NOT NULL,
	"vendor" varchar(50) NOT NULL,
	"status" varchar(30) DEFAULT 'inactive' NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_sis_import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"district_id" uuid NOT NULL,
	"connection_id" uuid,
	"status" varchar(30) DEFAULT 'queued' NOT NULL,
	"schools_count" integer DEFAULT 0,
	"classes_count" integer DEFAULT 0,
	"students_count" integer DEFAULT 0,
	"enrollments_count" integer DEFAULT 0,
	"warnings_json" jsonb DEFAULT '[]'::jsonb,
	"error_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"requested_by_id" uuid NOT NULL,
	"requested_by_role" varchar(40) NOT NULL,
	"status" varchar(30) DEFAULT 'queued' NOT NULL,
	"formats" jsonb DEFAULT '[]'::jsonb,
	"storage_refs" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"requester_role" varchar(40) NOT NULL,
	"status" varchar(40) DEFAULT 'PENDING_REVIEW' NOT NULL,
	"export_before_delete" jsonb DEFAULT 'true'::jsonb,
	"retention_hold_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dpa_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"district_id" uuid NOT NULL,
	"version" varchar(60) NOT NULL,
	"accepted_by_id" uuid NOT NULL,
	"accepted_by_name" text NOT NULL,
	"accepted_by_role" varchar(40) NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enterprise_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"actor_id" uuid,
	"actor_role" varchar(40) NOT NULL,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" varchar(255),
	"learner_id" uuid,
	"before_hash" varchar(64),
	"after_hash" varchar(64),
	"reason" text,
	"ip_hash" varchar(64),
	"user_agent_hash" varchar(64),
	"metadata_json" jsonb DEFAULT '{}'::jsonb,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oidc_signing_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kid" text NOT NULL,
	"jwk" jsonb NOT NULL,
	"public_jwk" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "oidc_signing_keys_kid_unique" UNIQUE("kid")
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lti_ags_lineitems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_link_id" uuid NOT NULL,
	"lineitem_url" text NOT NULL,
	"label" text,
	"score_maximum" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lti_contexts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deployment_id" uuid NOT NULL,
	"lti_context_id" text NOT NULL,
	"label" text,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lti_deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform_id" uuid NOT NULL,
	"deployment_id" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lti_platforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"issuer" text NOT NULL,
	"client_id" text NOT NULL,
	"jwks_url" text NOT NULL,
	"auth_token_url" text NOT NULL,
	"auth_login_url" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lti_resource_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"context_id" uuid NOT NULL,
	"resource_link_id" text NOT NULL,
	"title" text,
	"target_link_uri" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_anchors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anchored_at" timestamp with time zone DEFAULT now() NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"event_count" bigint NOT NULL,
	"head_hash" varchar(64) NOT NULL,
	"worm_ref" text
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_events_v2" (
	"id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"tenant_id" uuid,
	"actor_id" varchar(128) NOT NULL,
	"actor_role" varchar(48) NOT NULL,
	"actor_ip" varchar(64) DEFAULT '' NOT NULL,
	"actor_ua" text DEFAULT '' NOT NULL,
	"action" varchar(128) NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" varchar(255) DEFAULT '' NOT NULL,
	"outcome" varchar(16) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"request_id" varchar(128) DEFAULT '' NOT NULL,
	"prev_hash" varchar(64) DEFAULT '' NOT NULL,
	"hash" varchar(64) NOT NULL,
	CONSTRAINT "audit_events_v2_id_occurred_at_pk" PRIMARY KEY("id","occurred_at")
);;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "impersonation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"tenant_id" uuid,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ends_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"reason" text NOT NULL,
	"allow_writes" boolean DEFAULT false NOT NULL,
	"consent_basis" varchar(40),
	"ip" varchar(45),
	"ua" text,
	"justification_ticket_id" varchar(128)
);;

--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aac_vocabulary_learner_id_learners_id_fk') THEN
    ALTER TABLE "aac_vocabulary" ADD CONSTRAINT "aac_vocabulary_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lti_ags_lineitems_resource_link_id_lti_resource_links_id_fk') THEN
    ALTER TABLE "lti_ags_lineitems" ADD CONSTRAINT "lti_ags_lineitems_resource_link_id_lti_resource_links_id_fk" FOREIGN KEY ("resource_link_id") REFERENCES "public"."lti_resource_links"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lti_contexts_deployment_id_lti_deployments_id_fk') THEN
    ALTER TABLE "lti_contexts" ADD CONSTRAINT "lti_contexts_deployment_id_lti_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."lti_deployments"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lti_deployments_platform_id_lti_platforms_id_fk') THEN
    ALTER TABLE "lti_deployments" ADD CONSTRAINT "lti_deployments_platform_id_lti_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."lti_platforms"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lti_resource_links_context_id_lti_contexts_id_fk') THEN
    ALTER TABLE "lti_resource_links" ADD CONSTRAINT "lti_resource_links_context_id_lti_contexts_id_fk" FOREIGN KEY ("context_id") REFERENCES "public"."lti_contexts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'impersonation_sessions_actor_id_users_id_fk') THEN
    ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'impersonation_sessions_subject_id_users_id_fk') THEN
    ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_subject_id_users_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'impersonation_sessions_tenant_id_tenants_id_fk') THEN
    ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_aac_vocab_learner_locale_symbol" ON "aac_vocabulary" USING btree ("learner_id","locale","symbol_key");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aac_vocab_learner_locale" ON "aac_vocabulary" USING btree ("learner_id","locale");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_problem_session_attempts_session" ON "problem_session_attempts" USING btree ("problem_session_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_problem_session_attempts_number" ON "problem_session_attempts" USING btree ("attempt_number");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_problem_session_events_session" ON "problem_session_events" USING btree ("problem_session_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_problem_session_events_type" ON "problem_session_events" USING btree ("event_type");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_problem_session_events_occurred" ON "problem_session_events" USING btree ("occurred_at");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_problem_session_events_tenant" ON "problem_session_events" USING btree ("tenant_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_problem_session_snapshots_session" ON "problem_session_surface_snapshots" USING btree ("problem_session_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_problem_session_snapshots_surface" ON "problem_session_surface_snapshots" USING btree ("surface_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_problem_sessions_tenant" ON "problem_sessions" USING btree ("tenant_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_problem_sessions_learner" ON "problem_sessions" USING btree ("learner_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_problem_sessions_subject" ON "problem_sessions" USING btree ("subject");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_problem_sessions_skill" ON "problem_sessions" USING btree ("skill_code");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_problem_sessions_standard" ON "problem_sessions" USING btree ("standard_code");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_class_enrollments_class" ON "class_enrollments" USING btree ("class_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_class_enrollments_learner" ON "class_enrollments" USING btree ("learner_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_district_admin_assignments_district" ON "district_admin_assignments" USING btree ("district_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_district_admin_assignments_user" ON "district_admin_assignments" USING btree ("user_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enterprise_classes_school" ON "enterprise_classes" USING btree ("school_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enterprise_classes_external" ON "enterprise_classes" USING btree ("external_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enterprise_districts_external" ON "enterprise_districts" USING btree ("external_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enterprise_schools_district" ON "enterprise_schools" USING btree ("district_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enterprise_schools_external" ON "enterprise_schools" USING btree ("external_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_teacher_assignments_class" ON "teacher_assignments" USING btree ("class_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_teacher_assignments_teacher" ON "teacher_assignments" USING btree ("teacher_user_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enterprise_lti_launches_tool" ON "enterprise_lti_launches" USING btree ("tool_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enterprise_lti_launches_learner" ON "enterprise_lti_launches" USING btree ("learner_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enterprise_lti_tools_district" ON "enterprise_lti_tools" USING btree ("district_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enterprise_lti_tools_issuer" ON "enterprise_lti_tools" USING btree ("issuer");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enterprise_sis_conn_district" ON "enterprise_sis_connections" USING btree ("district_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enterprise_sis_conn_vendor" ON "enterprise_sis_connections" USING btree ("vendor");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enterprise_sis_jobs_district" ON "enterprise_sis_import_jobs" USING btree ("district_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enterprise_sis_jobs_status" ON "enterprise_sis_import_jobs" USING btree ("status");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_data_export_jobs_learner" ON "data_export_jobs" USING btree ("learner_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_data_export_jobs_status" ON "data_export_jobs" USING btree ("status");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_deletion_requests_learner" ON "deletion_requests" USING btree ("learner_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_deletion_requests_status" ON "deletion_requests" USING btree ("status");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dpa_acceptances_district" ON "dpa_acceptances" USING btree ("district_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dpa_acceptances_version" ON "dpa_acceptances" USING btree ("version");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enterprise_audit_tenant" ON "enterprise_audit_events" USING btree ("tenant_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enterprise_audit_learner" ON "enterprise_audit_events" USING btree ("learner_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enterprise_audit_action" ON "enterprise_audit_events" USING btree ("action");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enterprise_audit_occurred" ON "enterprise_audit_events" USING btree ("occurred_at");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oidc_signing_keys_active_idx" ON "oidc_signing_keys" USING btree ("active","created_at");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lti_ags_by_resource" ON "lti_ags_lineitems" USING btree ("resource_link_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lti_contexts_by_deployment" ON "lti_contexts" USING btree ("deployment_id");;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lti_contexts_unique_idx" ON "lti_contexts" USING btree ("deployment_id","lti_context_id");;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lti_deployments_unique_idx" ON "lti_deployments" USING btree ("platform_id","deployment_id");;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lti_platforms_issuer_client_idx" ON "lti_platforms" USING btree ("issuer","client_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lti_resource_links_by_context" ON "lti_resource_links" USING btree ("context_id");;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lti_resource_links_unique_idx" ON "lti_resource_links" USING btree ("context_id","resource_link_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_v2_tenant_idx" ON "audit_events_v2" USING btree ("tenant_id","occurred_at");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_v2_action_idx" ON "audit_events_v2" USING btree ("action","occurred_at");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_v2_actor_idx" ON "audit_events_v2" USING btree ("actor_id","occurred_at");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_v2_entity_idx" ON "audit_events_v2" USING btree ("entity_type","entity_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_impersonation_actor" ON "impersonation_sessions" USING btree ("actor_id","started_at");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_impersonation_subject" ON "impersonation_sessions" USING btree ("subject_id");;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_impersonation_active" ON "impersonation_sessions" USING btree ("ended_at");;

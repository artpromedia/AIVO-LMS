-- Backfill migration for tables that were declared in
-- packages/db/src/schema/ but had no corresponding CREATE TABLE migration.
-- Caught by the check:schema-drift CI guardrail. All statements are
-- idempotent (IF NOT EXISTS) so running on environments that already
-- received them via `db:push` is safe.

-- ── admin.evidenceBundles (services/admin-svc SOC2 evidence) ────────────────
CREATE TABLE IF NOT EXISTS "evidence_bundles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "bundle_date" varchar(10) NOT NULL UNIQUE,
  "filename" varchar(255) NOT NULL,
  "size_bytes" integer NOT NULL,
  "sha256" varchar(64) NOT NULL,
  "summary" jsonb NOT NULL,
  "generated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_evidence_bundles_date" ON "evidence_bundles" ("bundle_date");

-- ── comms.contactSubmissions (marketing / contact form) ────────────────────
CREATE TABLE IF NOT EXISTS "contact_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type" varchar(50) NOT NULL,
  "name" varchar(255),
  "email" varchar(255) NOT NULL,
  "company" varchar(255),
  "role" varchar(100),
  "school_size" varchar(50),
  "message" text,
  "source" varchar(100),
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- ── curriculum.curriculumUploads (teacher / parent curriculum ingestion) ───
CREATE TABLE IF NOT EXISTS "curriculum_uploads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid REFERENCES "tenants"("id"),
  "learner_id" uuid NOT NULL REFERENCES "learners"("id") ON DELETE CASCADE,
  "uploaded_by" uuid NOT NULL REFERENCES "users"("id"),
  "uploader_role" varchar(32) NOT NULL,
  "subject" varchar(64) NOT NULL,
  "title" varchar(255),
  "source_type" varchar(16) NOT NULL,
  "file_name" varchar(255),
  "mime_type" varchar(100),
  "raw_text" text,
  "parsed_focus" jsonb DEFAULT '{}'::jsonb,
  "week_start" timestamp with time zone,
  "week_end" timestamp with time zone,
  "status" varchar(24) NOT NULL DEFAULT 'PROCESSING',
  "notes" text,
  "class_group_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "curriculum_uploads_learner_id_idx" ON "curriculum_uploads" ("learner_id");
CREATE INDEX IF NOT EXISTS "curriculum_uploads_subject_idx" ON "curriculum_uploads" ("subject");
CREATE INDEX IF NOT EXISTS "curriculum_uploads_status_idx" ON "curriculum_uploads" ("status");
CREATE INDEX IF NOT EXISTS "curriculum_uploads_class_group_idx" ON "curriculum_uploads" ("class_group_id");

-- ── district.districtAdminInvites (delegated admin invites, sprint 8) ──────
CREATE TABLE IF NOT EXISTS "district_admin_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "email" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "invited_by" uuid NOT NULL REFERENCES "users"("id"),
  "token_hash" varchar(128) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "accepted_at" timestamp,
  "accepted_user_id" uuid REFERENCES "users"("id"),
  "revoked_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_district_admin_invites_tenant" ON "district_admin_invites" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_district_admin_invites_token" ON "district_admin_invites" ("token_hash");

-- ── district.seatRequests (seat self-service requests, sprint 9) ───────────
CREATE TABLE IF NOT EXISTS "seat_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "requested_by" uuid NOT NULL REFERENCES "users"("id"),
  "current_seats" integer NOT NULL,
  "requested_seats" integer NOT NULL,
  "justification" text,
  "status" varchar(32) NOT NULL DEFAULT 'pending',
  "resolved_at" timestamp,
  "resolved_by" uuid REFERENCES "users"("id"),
  "resolution_notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_seat_requests_tenant" ON "seat_requests" ("tenant_id", "created_at");

-- ── users.passwordResetTokens (password reset flow) ────────────────────────
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "token_hash" varchar(128) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_idx" ON "password_reset_tokens" ("token_hash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_idx" ON "password_reset_tokens" ("user_id");

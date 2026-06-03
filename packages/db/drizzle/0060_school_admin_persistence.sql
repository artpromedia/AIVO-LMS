-- Durable persistence for the school-admin console (admin-svc).
--
-- Replaces the in-memory Maps that previously backed classroom CRUD, the
-- per-school notification-preference matrix, and the learner bulk-import
-- routes. `school_id` is an opaque varchar (externally supplied id);
-- finer school-ownership scoping is enforced at the BFF/identity layer.
-- See services/admin-svc/src/stores/* and the dpa-store precedent in
-- services/data-governance-svc/src/services/dpa-store.ts.

CREATE TABLE IF NOT EXISTS "admin_classrooms" (
  "id" varchar(64) PRIMARY KEY,
  "school_id" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "grade" varchar(32),
  "teacher_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "co_teacher_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "learner_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_admin_classrooms_school" ON "admin_classrooms" ("school_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "admin_notification_prefs" (
  "school_id" varchar(255) PRIMARY KEY,
  "matrix" jsonb NOT NULL,
  "updated_by" varchar(64),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "learner_import_jobs" (
  "job_id" varchar(64) PRIMARY KEY,
  "school_id" varchar(255) NOT NULL,
  "status" varchar(16) DEFAULT 'pending' NOT NULL,
  "progress" jsonb NOT NULL,
  "errors" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_learner_import_jobs_school" ON "learner_import_jobs" ("school_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "learner_import_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" varchar(255) NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "data" jsonb NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_learner_import_records_unique" ON "learner_import_records" ("school_id", "external_id");

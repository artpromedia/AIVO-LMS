-- Preconditions for invite-flows migrations 0041-0043
-- All IF NOT EXISTS so safe to re-run.

CREATE TABLE IF NOT EXISTS "schools" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "address" text,
  "city" varchar(100),
  "state" varchar(50),
  "zip" varchar(20),
  "phone" varchar(50),
  "principal_name" varchar(255),
  "principal_email" varchar(255),
  "enrollment_capacity" integer,
  "grade_levels" jsonb DEFAULT '[]'::jsonb,
  "status" varchar(20) DEFAULT 'active',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "classrooms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "school_id" uuid,
  "teacher_id" uuid,
  "name" varchar(255) NOT NULL,
  "grade_level" varchar(50),
  "subject" varchar(100),
  "academic_year" varchar(20),
  "status" varchar(20) DEFAULT 'active',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "learner_teachers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "learner_id" uuid NOT NULL,
  "teacher_id" uuid NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'PENDING',
  "invited_at" timestamp DEFAULT now() NOT NULL,
  "accepted_at" timestamp,
  "revoked_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

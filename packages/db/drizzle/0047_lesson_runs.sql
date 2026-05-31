-- Lesson-run persistence — backs the LessonRunStore so
-- AIVO_PERSISTENCE_LESSON_RUNS=postgres can replace the in-memory store.
--
-- IDs / learner / tenant / subject / skill are application-generated
-- opaque strings (TEXT, no FK) and timestamps are ISO-8601 TEXT so the
-- adapter round-trips the exact domain object and ORDER BY created_at
-- DESC is a chronological sort. Heavy nested payloads live in JSONB.

CREATE TABLE IF NOT EXISTS "lesson_runs" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "learner_id" TEXT NOT NULL,
  "subject_id" TEXT,
  "skill_id" TEXT,
  "source" TEXT,
  "source_ref_id" TEXT,
  "tutor_persona" TEXT,
  "lesson_plan_id" TEXT,
  "status" TEXT NOT NULL,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "failure_reason" TEXT,
  "started_at" TEXT,
  "completed_at" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "snapshots" JSONB NOT NULL DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_runs_learner_idx" ON "lesson_runs" ("learner_id", "tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_runs_created_idx" ON "lesson_runs" ("created_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "generated_lesson_plans" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "lesson_run_id" TEXT,
  "data" JSONB NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "lesson_interactions" (
  "id" TEXT PRIMARY KEY,
  "lesson_run_id" TEXT NOT NULL,
  "learner_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "step_kind" TEXT NOT NULL,
  "step_ref_id" TEXT,
  "response" TEXT,
  "is_correct" BOOLEAN,
  "skipped" BOOLEAN NOT NULL DEFAULT false,
  "occurred_at" TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_interactions_run_idx" ON "lesson_interactions" ("lesson_run_id", "tenant_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "lesson_parent_summaries" (
  "id" TEXT PRIMARY KEY,
  "lesson_run_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "learner_id" TEXT NOT NULL,
  "data" JSONB NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_parent_summaries_run_idx" ON "lesson_parent_summaries" ("lesson_run_id", "tenant_id");

-- 0089_web_standards.sql
--
-- Sprint 8 remainder: web-owned standards / skill-graph reference. Standards
-- frameworks/documents/standards/domains, skill prerequisites/versions,
-- curriculum maps, lesson-objective templates, assessment blueprints, and the
-- curriculum-import job log. Platform-global reference data ⇒ NO RLS, like
-- web_policy_versions / web_subprocessors.
--
-- Boundary (ADR 0015): per-learner curriculum uploads + term syllabi are owned
-- by tutor-svc (read/written over REST) and are NOT migrated here.
-- aivo_app granted via 0050.

CREATE TABLE IF NOT EXISTS "web_standards_frameworks" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_standard_documents" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_standards" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_domains" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_skill_prerequisites" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_skill_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_curriculum_maps" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_lesson_objective_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_assessment_blueprints" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_curriculum_import_jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);

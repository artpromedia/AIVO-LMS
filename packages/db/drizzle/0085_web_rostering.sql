-- 0085_web_rostering.sql
--
-- Sprint 6 (persistence migration): durable web-owned rostering / SIS / lesson-
-- sync aggregates. Roster-import jobs + per-row errors must survive restarts
-- and be re-runnable; lesson-sync state (keyed by lessonRunId) must be durable
-- across devices. The admin domain already owns schools/classrooms/enrollments.
--
-- Boundary (ADR 0015): canonical SIS sync is owned by integrations-svc, the
-- teacher-rostering grant by identity-svc (read over REST; the in-memory
-- sis-store.ts / rostering-grants.ts are dev mocks, not migrated here).
--
-- NOT RLS-protected: tenant-scoped in app code, but roster-import has a
-- platform-admin cross-tenant escape hatch (getRosterImportJobAny) and lesson-
-- sync enforces learner/tenant scoping in app code — same app-layer-scoping
-- choice as the other admin-accessed web_* tables. aivo_app is granted via
-- 0050's ALTER DEFAULT PRIVILEGES. See packages/db/src/schema/web-rostering.ts.

CREATE TABLE IF NOT EXISTS "web_courses" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_courses_tenant_idx" ON "web_courses" ("tenant_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_roster_import_jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_roster_import_jobs_tenant_idx"
  ON "web_roster_import_jobs" ("tenant_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_roster_import_errors" (
  "id" text PRIMARY KEY NOT NULL,
  "job_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_roster_import_errors_job_idx"
  ON "web_roster_import_errors" ("job_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_sis_connections" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_sis_connections_tenant_idx"
  ON "web_sis_connections" ("tenant_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_external_roster_mappings" (
  "id" text PRIMARY KEY NOT NULL,
  "connection_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_external_roster_mappings_conn_idx"
  ON "web_external_roster_mappings" ("connection_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_lesson_sync_states" (
  "lesson_run_id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "data" jsonb NOT NULL
);

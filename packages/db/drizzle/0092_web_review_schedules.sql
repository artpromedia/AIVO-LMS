-- 0092_web_review_schedules.sql
--
-- Per-learner spaced-review schedules produced when a baseline assessment
-- completes. The memory store always had this collection; this lands the
-- Postgres twin so baseline finalization can persist review schedules
-- through the CurriculumStore adapter instead of the test-fixture Map store.
-- Table + index only — tenant-isolation RLS and the aivo_app grant follow in
-- 0093, mirroring the 0049 (tables) / 0050 (RLS + grants) split.

CREATE TABLE IF NOT EXISTS "web_review_schedules" (
  "id" TEXT PRIMARY KEY,
  "learner_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "data" JSONB NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_review_schedules_idx" ON "web_review_schedules" ("learner_id", "tenant_id");

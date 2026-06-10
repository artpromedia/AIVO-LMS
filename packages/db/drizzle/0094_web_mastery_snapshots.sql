-- 0094_web_mastery_snapshots.sql
--
-- Per-learner, per-subject mastery trajectory (adaptive-learning E2E
-- Sprint 3). One append-only row per capture (baseline completion, lesson
-- level change, scheduled), so the parent progress page can show
-- "was at X, now at Y, Z to grade level". Table + index here; RLS + grant
-- in 0095, mirroring the 0049/0050 split.

CREATE TABLE IF NOT EXISTS "web_mastery_snapshots" (
  "id" TEXT PRIMARY KEY,
  "learner_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "subject_id" TEXT NOT NULL,
  "captured_at" TEXT NOT NULL,
  "data" JSONB NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_mastery_snapshots_idx" ON "web_mastery_snapshots" ("learner_id", "tenant_id", "subject_id", "captured_at");

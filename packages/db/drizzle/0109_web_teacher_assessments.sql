-- 0109_web_teacher_assessments.sql
--
-- Sprint C-07 — the teacher assessment wizard's web-v2 autosave DRAFT store.
-- The system of record for a SUBMITTED teacher assessment is assessment-svc
-- (`teacher_assessments`). This table only buffers the IN-PROGRESS wizard so a
-- time-poor teacher who closes the tab mid-step resumes exactly where they left
-- off. One row per (learner, tenant, submitting teacher) so two co-teachers of
-- the same learner each keep their own draft. App-generated TEXT id (no FK),
-- the full draft object in `data` JSONB — mirrors web_parent_assessments.
-- Table + index here; RLS + grant in 0110, mirroring the 0049/0050 split (the
-- hermetic test schema skips the RLS file the same way it skips 0050).

CREATE TABLE IF NOT EXISTS "web_teacher_assessments" (
  "id" TEXT PRIMARY KEY,
  "learner_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "submitted_by_user_id" TEXT NOT NULL,
  "data" JSONB NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_teacher_assessments_idx" ON "web_teacher_assessments" ("learner_id", "tenant_id", "submitted_by_user_id");

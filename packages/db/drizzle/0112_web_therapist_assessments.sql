-- 0112_web_therapist_assessments.sql
--
-- Sprint C-10 — the therapist assessment form's web-v2 autosave DRAFT store.
-- Sibling of web_teacher_assessments (0109). The system of record for a
-- SUBMITTED therapist assessment is assessment-svc (`therapist_assessments`);
-- this table only buffers the IN-PROGRESS single-page form so a time-poor
-- clinician who closes the tab mid-entry resumes exactly where they left off.
-- One row per (learner, tenant, submitting therapist) so two therapists on the
-- same caseload each keep their own draft. App-generated TEXT id (no FK), the
-- full draft object in `data` JSONB — mirrors web_teacher_assessments. Table +
-- index here; RLS + grant in 0113, mirroring the 0109/0110 split (the hermetic
-- test schema skips the RLS file the same way it skips 0110).

CREATE TABLE IF NOT EXISTS "web_therapist_assessments" (
  "id" TEXT PRIMARY KEY,
  "learner_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "submitted_by_user_id" TEXT NOT NULL,
  "data" JSONB NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_therapist_assessments_idx" ON "web_therapist_assessments" ("learner_id", "tenant_id", "submitted_by_user_id");

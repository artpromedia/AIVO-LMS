-- 0069_syllabus_validation.sql
-- Syllabus ↔ jurisdiction validation (Sprint 7, G8). Each term-syllabus unit
-- records whether its topics/standards are in the learner's jurisdiction-
-- approved packs. Idempotent (IF NOT EXISTS column guards).

ALTER TABLE term_syllabus_units
  ADD COLUMN IF NOT EXISTS validation_status varchar(24) NOT NULL DEFAULT 'unvalidated';

ALTER TABLE term_syllabus_units
  ADD COLUMN IF NOT EXISTS validation_notes jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS term_syllabus_units_validation_idx
  ON term_syllabus_units (validation_status);

-- Sprint 4 (invite-flows) — classroom affinity for learner_teachers.
--
-- A teacher can reach a learner through two paths:
--   1. classroom_enrollments (the district roster path)
--   2. learner_teachers ACCEPTED rows (the parent-invite path)
--
-- Today these are unrelated tables, so a teacher who serves the same
-- learner via both shows up as two rows in the unified roster API. The
-- nullable classroom_id column lets a learner_teachers row record which
-- classroom (if any) the relationship corresponds to, so the roster
-- query can deduplicate and the UI can surface the classroom name on
-- the parent-invite path.
--
-- Set automatically by the accept-invite handler when the accepting
-- teacher is the teacher_id on a classroom that has the learner enrolled.
ALTER TABLE "learner_teachers"
  ADD COLUMN IF NOT EXISTS "classroom_id" uuid REFERENCES "classrooms"("id");

CREATE INDEX IF NOT EXISTS "idx_learner_teachers_classroom"
  ON "learner_teachers" ("classroom_id");

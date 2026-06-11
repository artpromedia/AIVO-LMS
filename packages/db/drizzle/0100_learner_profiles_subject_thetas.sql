-- Wave C (G1) — per-subject placement.
-- Per-subject θ estimates on the canonical learner profile, keyed by the
-- canonical subject key (see @aivo/scoring canonicalSubjectKey):
--   { "math": -0.8, "reading": 0.5 }
-- The baseline finalizers (adaptive run-loop + Discovery complete) write
-- this alongside theta_placement; curriculum-alignment derives
-- curriculum_alignment.delivery_levels from it so a learner two grades
-- behind in math but on grade in reading is DELIVERED each subject at
-- its own band. Nullable: profiles finalized before this migration (or
-- runs with too few per-subject items) simply have no split.
ALTER TABLE "learner_profiles"
  ADD COLUMN IF NOT EXISTS "subject_thetas" jsonb;

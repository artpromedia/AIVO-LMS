-- Migration 0028: Optional teacher input + co-parent attribution for
-- the adaptive baseline assessment.
--
-- Strategic backdrop: the baseline LLM prompt already consumes the
-- parent assessment and (when uploaded) the IEP. The product
-- requirement is that BOTH co-parent perspectives and teacher input
-- can also feed generation, but all three should remain optional so
-- a learner with only a parent assessment still gets a baseline.
--
-- This migration:
--   1. Adds `submitted_by` (nullable) to parent_assessments so the
--      generator can distinguish parent from co-parent rows.
--   2. Creates `teacher_assessments`, parallel in shape to
--      parent_assessments but every field nullable so a teacher can
--      submit only what they have.
--
-- Both changes are backwards compatible: existing rows still load and
-- the generator falls back to "no data on file" for absent inputs.

ALTER TABLE parent_assessments
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_parent_assessments_learner_submitter
  ON parent_assessments (learner_id, submitted_by);

CREATE TABLE IF NOT EXISTS teacher_assessments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id),
  learner_id               UUID NOT NULL REFERENCES learners(id),
  submitted_by             UUID REFERENCES users(id),
  teacher_role             VARCHAR(100),
  grade_level              VARCHAR(20),
  subject_area             VARCHAR(100),
  strengths                JSONB DEFAULT '[]'::jsonb,
  challenges               JSONB DEFAULT '[]'::jsonb,
  accommodations           JSONB DEFAULT '[]'::jsonb,
  observations             TEXT,
  recommended_focus_areas  JSONB DEFAULT '[]'::jsonb,
  responses                JSONB DEFAULT '{}'::jsonb,
  completed_at             TIMESTAMP,
  created_at               TIMESTAMP NOT NULL DEFAULT now(),
  updated_at               TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_assessments_learner
  ON teacher_assessments (learner_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assessments_learner_completed
  ON teacher_assessments (learner_id, completed_at DESC);

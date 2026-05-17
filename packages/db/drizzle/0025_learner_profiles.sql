-- Migration 0025: Adaptive multimodal baseline — LearningProfile artifact
-- Per the strategic advice: the baseline grade-level placement is one
-- output, but the learning profile (modality fit, processing speed,
-- frustration tolerance, attention pattern) is the more valuable one
-- and the one the tutor-runtime + parent dashboard actually consume.

CREATE TABLE learner_profiles (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id),
  learner_id               UUID NOT NULL UNIQUE REFERENCES learners(id) ON DELETE CASCADE,
  attempt_id               UUID REFERENCES assessment_attempts(id),
  theta_placement          REAL NOT NULL DEFAULT 0,
  modality_fit             JSONB NOT NULL DEFAULT '[]',
  processing_speed_ms      INTEGER NOT NULL DEFAULT 0,
  frustration_rate         REAL NOT NULL DEFAULT 0,
  attention_run_length     INTEGER NOT NULL DEFAULT 0,
  frustration_tolerance    VARCHAR(16) NOT NULL DEFAULT 'moderate',
  items_administered       INTEGER NOT NULL DEFAULT 0,
  baseline_completed_at    TIMESTAMP NOT NULL DEFAULT now(),
  updated_at               TIMESTAMP NOT NULL DEFAULT now(),
  created_at               TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_learner_profiles_tenant ON learner_profiles (tenant_id);

CREATE TABLE adaptive_baseline_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  learner_id   UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  status       VARCHAR(16) NOT NULL DEFAULT 'in_progress',
  state        JSONB NOT NULL,
  started_at   TIMESTAMP NOT NULL DEFAULT now(),
  completed_at TIMESTAMP,
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_adaptive_baseline_learner ON adaptive_baseline_sessions (learner_id);
CREATE INDEX idx_adaptive_baseline_status ON adaptive_baseline_sessions (status);

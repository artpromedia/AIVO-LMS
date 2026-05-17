-- Migration 0027: Executive-function partner tables
-- Per the strategic advice: ADHD is fundamentally an executive-function
-- challenge.  The agent quietly carries the planning load — it breaks
-- tasks down visually, surfaces "you've been stuck three minutes —
-- want to try this differently?" prompts, and remembers what worked
-- yesterday morning vs. afternoon.  This migration is the persistence
-- layer behind those features.

CREATE TABLE ef_task_breakdowns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  learner_id   UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  task_id      VARCHAR(128) NOT NULL,
  title        VARCHAR(255) NOT NULL,
  total_weight INTEGER NOT NULL,
  steps        JSONB NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_ef_breakdowns_learner ON ef_task_breakdowns (learner_id);
CREATE INDEX idx_ef_breakdowns_task ON ef_task_breakdowns (learner_id, task_id);

CREATE TABLE ef_task_step_progress (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  breakdown_id  UUID NOT NULL REFERENCES ef_task_breakdowns(id) ON DELETE CASCADE,
  step_id       VARCHAR(64) NOT NULL,
  completed_at  TIMESTAMP NOT NULL DEFAULT now(),
  dwell_ms      INTEGER
);

CREATE INDEX idx_ef_step_progress_breakdown ON ef_task_step_progress (breakdown_id);
CREATE UNIQUE INDEX idx_ef_step_progress_unique ON ef_task_step_progress (breakdown_id, step_id);

CREATE TABLE ef_session_outcomes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id),
  learner_id         UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  started_at         TIMESTAMP NOT NULL,
  time_of_day        VARCHAR(16) NOT NULL,
  subject            VARCHAR(64),
  modality           VARCHAR(16),
  accuracy           REAL NOT NULL,
  frustration_rate   REAL NOT NULL DEFAULT 0,
  attention_minutes  INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_ef_session_outcomes_learner ON ef_session_outcomes (learner_id, started_at DESC);
CREATE INDEX idx_ef_session_outcomes_tod ON ef_session_outcomes (learner_id, time_of_day);

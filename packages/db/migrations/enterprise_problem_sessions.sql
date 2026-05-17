-- Sprint 02: Problem session ledger (additive, reversible).
-- This migration creates four ledger tables for the problem-session-svc.
-- All columns are additive. No existing table is modified.

CREATE TABLE IF NOT EXISTS problem_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  subject varchar(100) NOT NULL,
  skill_code varchar(100),
  standard_code varchar(100),
  source varchar(50) NOT NULL,
  source_session_id uuid,
  tutor_sku varchar(100),
  status varchar(30) NOT NULL DEFAULT 'active',
  started_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp,
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_problem_sessions_tenant ON problem_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_problem_sessions_learner ON problem_sessions(learner_id);
CREATE INDEX IF NOT EXISTS idx_problem_sessions_subject ON problem_sessions(subject);
CREATE INDEX IF NOT EXISTS idx_problem_sessions_skill ON problem_sessions(skill_code);
CREATE INDEX IF NOT EXISTS idx_problem_sessions_standard ON problem_sessions(standard_code);

CREATE TABLE IF NOT EXISTS problem_session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_session_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  event_type varchar(80) NOT NULL,
  event_payload_json jsonb DEFAULT '{}'::jsonb,
  redacted_payload_json jsonb DEFAULT '{}'::jsonb,
  occurred_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_problem_session_events_session ON problem_session_events(problem_session_id);
CREATE INDEX IF NOT EXISTS idx_problem_session_events_type ON problem_session_events(event_type);
CREATE INDEX IF NOT EXISTS idx_problem_session_events_occurred ON problem_session_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_problem_session_events_tenant ON problem_session_events(tenant_id);

CREATE TABLE IF NOT EXISTS problem_session_surface_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_session_id uuid NOT NULL,
  surface_id varchar(100) NOT NULL,
  snapshot_type varchar(30) NOT NULL,
  snapshot_json jsonb DEFAULT '{}'::jsonb,
  storage_url text,
  stroke_count integer DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_problem_session_snapshots_session ON problem_session_surface_snapshots(problem_session_id);
CREATE INDEX IF NOT EXISTS idx_problem_session_snapshots_surface ON problem_session_surface_snapshots(surface_id);

CREATE TABLE IF NOT EXISTS problem_session_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_session_id uuid NOT NULL,
  attempt_number integer NOT NULL,
  response_json jsonb DEFAULT '{}'::jsonb,
  correct boolean DEFAULT false,
  score real,
  latency_ms integer DEFAULT 0,
  hint_count integer DEFAULT 0,
  eraser_count integer DEFAULT 0,
  tool_change_count integer DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_problem_session_attempts_session ON problem_session_attempts(problem_session_id);
CREATE INDEX IF NOT EXISTS idx_problem_session_attempts_number ON problem_session_attempts(attempt_number);

-- Down migration (manual rollback):
-- DROP TABLE IF EXISTS problem_session_attempts;
-- DROP TABLE IF EXISTS problem_session_surface_snapshots;
-- DROP TABLE IF EXISTS problem_session_events;
-- DROP TABLE IF EXISTS problem_sessions;

-- Wave E (S9) — tutor agent orchestrator state + decision audit trail.
--
-- 1. tutor_sessions.agent_state: the per-session agent loop state that must
--    survive between stateless turn requests (token envelope used/limit,
--    degradation-ladder rung + counters, monotonic turn seq). NULL for every
--    non-agent session, so existing chat sessions are untouched.
--
-- 2. tutor_decision_traces: one row per agent decision — accepted actions,
--    SessionMachine guard rejections, and ladder/ai-svc fallbacks — so a
--    session's reasoning can be replayed in order for audits and the
--    behavioural gate (S10). observation_digest matches the ai-svc decision
--    log without storing raw learner responses here.

ALTER TABLE tutor_sessions
  ADD COLUMN IF NOT EXISTS agent_state JSONB;

CREATE TABLE IF NOT EXISTS tutor_decision_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  session_id UUID NOT NULL REFERENCES tutor_sessions(id),
  learner_id UUID NOT NULL REFERENCES learners(id),
  tutor_key VARCHAR(32) NOT NULL,
  seq INTEGER NOT NULL,
  observation_digest VARCHAR(32) NOT NULL,
  action JSONB,
  rationale TEXT DEFAULT '',
  decision VARCHAR(120) NOT NULL,
  rung VARCHAR(16) NOT NULL DEFAULT 'full',
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Replay integrity: a session's decisions are strictly ordered.
CREATE UNIQUE INDEX IF NOT EXISTS tutor_decision_traces_session_seq_idx
  ON tutor_decision_traces (session_id, seq);

CREATE INDEX IF NOT EXISTS tutor_decision_traces_learner_idx
  ON tutor_decision_traces (tenant_id, learner_id, created_at);

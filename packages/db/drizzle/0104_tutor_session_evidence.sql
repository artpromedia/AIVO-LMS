-- Wave E (S11) — tutor agent evidence ledger.
--
-- The agent's `file_evidence` tool writes ONE row per observation it wants
-- remembered beyond the session: what it saw (kind + note), which skill it
-- concerns, and an optional SUPPLEMENTAL mastery signal. The signal is a
-- nudge, never an override: the adapter hard-clamps |mastery_delta| to
-- 0.05 before it ever reaches this table or the gradebook, so a hundred
-- agent sessions cannot move a skill further than honest assessment would.
CREATE TABLE IF NOT EXISTS tutor_session_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  session_id UUID NOT NULL REFERENCES tutor_sessions(id),
  learner_id UUID NOT NULL REFERENCES learners(id),
  skill_id VARCHAR(200),
  kind VARCHAR(30) NOT NULL,
  note TEXT NOT NULL,
  mastery_delta REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tutor_session_evidence_session_idx
  ON tutor_session_evidence (session_id);

CREATE INDEX IF NOT EXISTS tutor_session_evidence_learner_idx
  ON tutor_session_evidence (tenant_id, learner_id, created_at);

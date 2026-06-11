-- Wave E (S12) — consent-gated episodic tutor memory.
--
-- One row per `remember` tool call: a small, parent-visible note the tutor
-- may carry across sessions ("worked examples before practice help",
-- "loves trains", "long division triggers frustration"). Strictly bounded:
--   - written only in sessions opened behind ai_personalization consent
--     (BFF guard + orchestrator gate), <=2 writes per session;
--   - kind comes from the tutor's declared memoryPolicy.kinds;
--   - every row expires (180 days) and is purged by the admin-svc SafeCron;
--   - parents see and can delete every row (web memory card);
--   - erased with the learner via the ADR-0034 governance subscriber.
CREATE TABLE IF NOT EXISTS tutor_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  learner_id UUID NOT NULL REFERENCES learners(id),
  tutor_key VARCHAR(32) NOT NULL,
  kind VARCHAR(30) NOT NULL,
  content TEXT NOT NULL,
  source_session_id UUID REFERENCES tutor_sessions(id),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS tutor_memories_learner_idx
  ON tutor_memories (tenant_id, learner_id, tutor_key, created_at);

-- The expiry purge scans by expires_at alone.
CREATE INDEX IF NOT EXISTS tutor_memories_expiry_idx
  ON tutor_memories (expires_at);

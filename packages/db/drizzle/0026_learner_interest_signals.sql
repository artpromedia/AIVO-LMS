-- Migration 0026: Learner special-interest signals
-- Per the strategic advice: autistic kids often have deep, focused
-- interests — Minecraft, trains, dinosaurs, weather.  An agentic
-- system treats these as the *engine* (math word problems set in
-- Minecraft, passages about volcanoes), not as distractions to be
-- overcome.  This table feeds the `@aivo/special-interest-engine`
-- scoring function and is the persistence layer behind the family-svc
-- intake endpoints.

CREATE TABLE learner_interest_signals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  learner_id  UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  slug        VARCHAR(64) NOT NULL,
  source      VARCHAR(32) NOT NULL,
  polarity    INTEGER NOT NULL,
  confidence  REAL NOT NULL DEFAULT 1,
  observed_at TIMESTAMP NOT NULL DEFAULT now(),
  note        TEXT,
  recorded_by UUID,
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_interest_signals_learner ON learner_interest_signals (learner_id);
CREATE INDEX idx_interest_signals_slug ON learner_interest_signals (slug);
CREATE INDEX idx_interest_signals_observed ON learner_interest_signals (learner_id, observed_at DESC);

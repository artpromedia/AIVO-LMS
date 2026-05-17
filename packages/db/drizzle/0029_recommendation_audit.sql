-- Recommendation inbox — audit and amendment columns.
--
-- The recommendation inbox now generates structured recommendations and
-- applies approved/amended changes back to brain_states. We need to record
-- the parent's edits (amended_payload), the version that was actually
-- applied (applied_payload), supporting evidence/confidence, who acted,
-- when the effect was applied, and any error from the effect-handler.
-- All columns are nullable so existing rows are unaffected.

ALTER TABLE "brain_recommendations"
  ADD COLUMN IF NOT EXISTS "amended_payload" jsonb,
  ADD COLUMN IF NOT EXISTS "applied_payload" jsonb,
  ADD COLUMN IF NOT EXISTS "evidence" jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "source_signals" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "confidence" real,
  ADD COLUMN IF NOT EXISTS "apply_error" text,
  ADD COLUMN IF NOT EXISTS "applied_at" timestamp,
  ADD COLUMN IF NOT EXISTS "resolved_by" uuid;

CREATE INDEX IF NOT EXISTS "idx_brain_recommendations_learner_status"
  ON "brain_recommendations" ("learner_id", "status");

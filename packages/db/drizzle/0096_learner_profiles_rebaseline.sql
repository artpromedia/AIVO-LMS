-- 0096_learner_profiles_rebaseline.sql
--
-- Rebaseline marker (adaptive-learning E2E Sprint 4). Stamped when a parent
-- approves a rebaseline_request recommendation; the adaptive-baseline start
-- seeds the new run from the prior theta and finalization clears the marker.

ALTER TABLE "learner_profiles" ADD COLUMN IF NOT EXISTS "rebaseline_requested_at" timestamp;

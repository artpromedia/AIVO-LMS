-- 0096_learner_profiles_rebaseline.sql
--
-- Rebaseline marker (adaptive-learning E2E Sprint 4). Stamped when a parent
-- approves a rebaseline_request recommendation; the adaptive-baseline start
-- seeds the new run from the prior theta and finalization clears the marker.
--
-- Guarded: learner_profiles is created by the UNJOURNALED 0025 migration
-- (applied out-of-band via scripts/apply-mig-*.sh, like 0024-0029). On a
-- fresh journal-only database the table does not exist yet, so this ALTER
-- is conditional; environments apply 0025 first and re-run the idempotent
-- ALTER (see tests/integration/journey/setup-db.ts for the full sequence).

DO $$
BEGIN
  IF to_regclass('learner_profiles') IS NOT NULL THEN
    ALTER TABLE "learner_profiles" ADD COLUMN IF NOT EXISTS "rebaseline_requested_at" timestamp;
  END IF;
END $$;

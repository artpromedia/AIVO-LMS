-- Migration 0010 created iep_present_levels, iep_services, and iep_goals
-- with FK references to iep_profiles(id) but no ON DELETE clause — so a
-- DELETE on the parent profile would fail with a 23503 (foreign_key_violation)
-- once children existed. The DELETE handler in
-- assessment-svc/src/routes/iep-authoring.ts works around this by issuing
-- explicit child deletes ahead of the parent, but the contract is fragile:
-- any future code path that drops a profile (test cleanup, admin tooling,
-- TRUNCATE pipelines) hits the same wall.
--
-- This migration drops and re-adds those FKs with ON DELETE CASCADE so the
-- database itself sweeps the children. The handler can be simplified once
-- this lands.
--
-- Idempotent: each ALTER is wrapped in DO blocks that no-op when the
-- target constraint shape is already correct.

-- iep_present_levels.iep_profile_id → iep_profiles(id) ON DELETE CASCADE
ALTER TABLE "iep_present_levels"
  DROP CONSTRAINT IF EXISTS "iep_present_levels_iep_profile_id_iep_profiles_id_fk";
ALTER TABLE "iep_present_levels"
  ADD CONSTRAINT "iep_present_levels_iep_profile_id_iep_profiles_id_fk"
  FOREIGN KEY ("iep_profile_id") REFERENCES "iep_profiles"("id") ON DELETE CASCADE;

-- iep_services.iep_profile_id → iep_profiles(id) ON DELETE CASCADE
ALTER TABLE "iep_services"
  DROP CONSTRAINT IF EXISTS "iep_services_iep_profile_id_iep_profiles_id_fk";
ALTER TABLE "iep_services"
  ADD CONSTRAINT "iep_services_iep_profile_id_iep_profiles_id_fk"
  FOREIGN KEY ("iep_profile_id") REFERENCES "iep_profiles"("id") ON DELETE CASCADE;

-- iep_goals.iep_profile_id → iep_profiles(id) ON DELETE CASCADE
-- iep_goals.iep_profile_id is nullable (a goal can outlive its draft when the
-- finalised IEP is amended), so the cascade only runs when the FK is set.
ALTER TABLE "iep_goals"
  DROP CONSTRAINT IF EXISTS "iep_goals_iep_profile_id_iep_profiles_id_fk";
ALTER TABLE "iep_goals"
  ADD CONSTRAINT "iep_goals_iep_profile_id_iep_profiles_id_fk"
  FOREIGN KEY ("iep_profile_id") REFERENCES "iep_profiles"("id") ON DELETE CASCADE;

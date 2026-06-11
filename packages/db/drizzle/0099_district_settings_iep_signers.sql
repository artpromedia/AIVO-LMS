-- 0092_district_settings_iep_signers.sql
--
-- Phase C IEP collaboration policy: `district_settings.iep_required_signer_roles`
-- exists in the Drizzle schema (packages/db/src/schema/district.ts) but never
-- got a migration, so any freshly-migrated database 500s on every
-- district_settings read (/api/district/setup, /api/district/settings).
ALTER TABLE district_settings
  ADD COLUMN IF NOT EXISTS iep_required_signer_roles JSONB
  DEFAULT '["case_manager","parent","gen_ed_teacher"]'::jsonb;

-- Sprint 12.5: DPA acceptance records with full audit context.
--
-- Replaces the legacy `dpa_acceptances` table for net-new writes while
-- preserving the older table for historical reads. The new table captures
-- the tenant boundary (mandatory), optional school/district scoping, the
-- signing identity, request fingerprints (ip + user agent + signature
-- hash), and the addenda/state-addendum versions that were in effect at
-- acceptance time. Production reads/writes go through the Postgres DPA
-- store in services/data-governance-svc.
--
-- Additive migration: no destructive change to dpa_acceptances. A
-- backfill from the legacy table is intentionally NOT performed here —
-- legacy records lack signature_hash / tenant_id and would require a
-- one-time compliance review before backfilling.

CREATE TABLE IF NOT EXISTS dpa_acceptance_records (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  uuid NOT NULL,
  school_id                  uuid,
  district_id                uuid,
  template_version           text NOT NULL,
  accepted_by_user_id        uuid NOT NULL,
  accepted_at                timestamptz NOT NULL DEFAULT now(),
  ip_address                 inet,
  user_agent                 text,
  signature_hash             text NOT NULL,
  addenda                    jsonb NOT NULL DEFAULT '[]'::jsonb,
  state_addendum_versions    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dpa_acceptance_records_tenant_accepted
  ON dpa_acceptance_records (tenant_id, accepted_at DESC);

CREATE INDEX IF NOT EXISTS idx_dpa_acceptance_records_school
  ON dpa_acceptance_records (school_id);

CREATE INDEX IF NOT EXISTS idx_dpa_acceptance_records_district
  ON dpa_acceptance_records (district_id);

-- Down migration (manual rollback):
-- DROP INDEX IF EXISTS idx_dpa_acceptance_records_district;
-- DROP INDEX IF EXISTS idx_dpa_acceptance_records_school;
-- DROP INDEX IF EXISTS idx_dpa_acceptance_records_tenant_accepted;
-- DROP TABLE IF EXISTS dpa_acceptance_records;

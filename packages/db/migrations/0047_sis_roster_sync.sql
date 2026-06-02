-- Sprint 2 (SIS Roster Sync) — connector config, run history, per-row
-- staging, errors, and the external→internal id mapping.
--
-- SIS credentials are stored as encrypted envelopes (v1:iv:tag:ct, KMS data
-- key) in sis_configs.credentials — never plaintext. All upserts downstream
-- are keyed by (provider, external_id) via sync_mappings; removals are
-- soft-deletes, so no roster row is ever hard-deleted from these tables on a
-- normal run.

DO $$ BEGIN
  CREATE TYPE sis_provider AS ENUM ('oneroster_rest', 'oneroster_csv', 'clever', 'classlink');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE sync_run_type AS ENUM ('full', 'delta');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE sync_run_status AS ENUM ('queued', 'running', 'success', 'failed', 'paused');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS sis_configs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  provider            sis_provider NOT NULL,
  display_name        varchar(160) NOT NULL,
  enabled             boolean NOT NULL DEFAULT false,
  -- Encrypted credential envelope(s) + non-secret hint. JSONB, secrets never
  -- in plaintext (see lib/credentials.ts).
  credentials         jsonb NOT NULL DEFAULT '{}'::jsonb,
  field_mapping       jsonb NOT NULL DEFAULT '{}'::jsonb,
  full_schedule_cron  varchar(64) NOT NULL DEFAULT '0 2 * * *',
  delta_schedule_cron varchar(64) NOT NULL DEFAULT '0 */4 * * *',
  max_mutation_ratio  numeric(4,3) NOT NULL DEFAULT 0.100,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid
);
CREATE INDEX IF NOT EXISTS sis_configs_tenant_idx ON sis_configs (tenant_id);

CREATE TABLE IF NOT EXISTS sync_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id         uuid NOT NULL REFERENCES sis_configs(id) ON DELETE CASCADE,
  tenant_id         uuid NOT NULL,
  type              sync_run_type NOT NULL,
  dry_run           boolean NOT NULL DEFAULT false,
  status            sync_run_status NOT NULL DEFAULT 'queued',
  started_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz,
  added_count       integer NOT NULL DEFAULT 0,
  updated_count     integer NOT NULL DEFAULT 0,
  removed_count     integer NOT NULL DEFAULT 0,
  population        integer NOT NULL DEFAULT 0,
  mutation_ratio    numeric(6,5) NOT NULL DEFAULT 0,
  pause_reason      text,
  error_count       integer NOT NULL DEFAULT 0,
  -- Checkpoint for resume-after-crash (chaos safety).
  checkpoint        jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS sync_runs_config_started_idx ON sync_runs (config_id, started_at DESC);
CREATE INDEX IF NOT EXISTS sync_runs_tenant_idx ON sync_runs (tenant_id);

CREATE TABLE IF NOT EXISTS sync_rows (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  entity_kind       varchar(32) NOT NULL,
  external_id       varchar(255) NOT NULL,
  op                varchar(16) NOT NULL, -- add | update | softDelete
  applied           boolean NOT NULL DEFAULT false,
  attempts          integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sync_rows_run_idx ON sync_rows (run_id);
CREATE INDEX IF NOT EXISTS sync_rows_pending_idx ON sync_rows (run_id) WHERE applied = false;

CREATE TABLE IF NOT EXISTS sync_errors (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  config_id         uuid NOT NULL REFERENCES sis_configs(id) ON DELETE CASCADE,
  entity_kind       varchar(32) NOT NULL,
  external_id       varchar(255) NOT NULL,
  message           text NOT NULL,
  retryable         boolean NOT NULL DEFAULT true,
  resolved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sync_errors_config_open_idx ON sync_errors (config_id) WHERE resolved_at IS NULL;

-- The idempotency backbone: (provider, external_id) -> internal_id.
CREATE TABLE IF NOT EXISTS sync_mappings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  provider          sis_provider NOT NULL,
  entity_kind       varchar(32) NOT NULL,
  external_id       varchar(255) NOT NULL,
  internal_id       uuid NOT NULL,
  state             varchar(16) NOT NULL DEFAULT 'active', -- active | inactive
  effective_date    date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sync_mappings_uniq UNIQUE (tenant_id, provider, entity_kind, external_id)
);
CREATE INDEX IF NOT EXISTS sync_mappings_internal_idx ON sync_mappings (entity_kind, internal_id);

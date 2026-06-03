-- Responsible AI Console schema (Sprint 7).
--
-- responsible-ai-svc currently serves this data from a process-local
-- in-memory store (see src/registry/store.ts). This migration is the
-- authoritative schema a Postgres-backed implementation mirrors and is
-- applied by the shared migration runner when DATABASE_URL is set.

BEGIN;

CREATE TABLE IF NOT EXISTS models (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  provider         TEXT NOT NULL,
  modality         TEXT NOT NULL CHECK (modality IN ('text','vision','speech','multimodal','embedding')),
  status           TEXT NOT NULL CHECK (status IN ('draft','active','deprecated','retired')),
  owner_team       TEXT NOT NULL,
  owner_contact    TEXT NOT NULL,
  intended_use     TEXT NOT NULL DEFAULT '',
  out_of_scope_use TEXT NOT NULL DEFAULT '',
  current_version_id TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_models_status ON models (status);
CREATE INDEX IF NOT EXISTS idx_models_modality ON models (modality);

CREATE TABLE IF NOT EXISTS model_versions (
  id              TEXT PRIMARY KEY,
  model_id        TEXT NOT NULL REFERENCES models (id) ON DELETE CASCADE,
  version         TEXT NOT NULL,
  released_at     TIMESTAMPTZ NOT NULL,
  changelog       TEXT NOT NULL DEFAULT '',
  provenance_hash TEXT NOT NULL,
  UNIQUE (model_id, version)
);

CREATE TABLE IF NOT EXISTS model_cards (
  model_id  TEXT PRIMARY KEY REFERENCES models (id) ON DELETE CASCADE,
  markdown  TEXT NOT NULL,
  metadata  JSONB NOT NULL  -- NIST AI RMF GOVERN fields
);

CREATE TABLE IF NOT EXISTS policies (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  scope_level         TEXT NOT NULL CHECK (scope_level IN ('platform','district','tenant')),
  scope_id            TEXT,  -- NULL for platform
  content_safety      JSONB NOT NULL,
  age_gating          JSONB NOT NULL,
  region_restrictions JSONB NOT NULL,
  enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_policies_scope ON policies (scope_level, scope_id);

CREATE TABLE IF NOT EXISTS evals (
  id        TEXT PRIMARY KEY,
  model_id  TEXT NOT NULL REFERENCES models (id) ON DELETE CASCADE,
  harness   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eval_runs (
  id           TEXT PRIMARY KEY,
  model_id     TEXT NOT NULL REFERENCES models (id) ON DELETE CASCADE,
  harness      TEXT NOT NULL CHECK (harness IN ('safety-suite','accuracy-suite','bias-suite','full-suite')),
  status       TEXT NOT NULL CHECK (status IN ('queued','running','passed','failed')),
  metrics      JSONB,           -- {safety,accuracy,bias,refusalRate,hallucination}
  cases        JSONB NOT NULL DEFAULT '[]',
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  triggered_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_eval_runs_model ON eval_runs (model_id, started_at DESC);

CREATE TABLE IF NOT EXISTS incidents (
  id               TEXT PRIMARY KEY,
  model_id         TEXT REFERENCES models (id) ON DELETE SET NULL,
  tenant_id        TEXT,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  severity         TEXT NOT NULL CHECK (severity IN ('sev1','sev2','sev3','sev4')),
  state            TEXT NOT NULL CHECK (state IN ('open','investigating','mitigated','resolved','closed')),
  reported_by      TEXT NOT NULL,
  reported_by_role TEXT NOT NULL,
  timeline         JSONB NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_incidents_tenant ON incidents (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS optouts (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,  -- may be a districtId for cascade
  model_id        TEXT,
  feature         TEXT,
  reason          TEXT NOT NULL DEFAULT '',
  created_by      TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (model_id IS NOT NULL OR feature IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_optouts_tenant ON optouts (tenant_id);

CREATE TABLE IF NOT EXISTS usage_aggregates (
  model_id  TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  date      DATE NOT NULL,
  calls     BIGINT NOT NULL DEFAULT 0,
  tokens    BIGINT NOT NULL DEFAULT 0,
  cost_usd  NUMERIC(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (model_id, tenant_id, date)
);

COMMIT;

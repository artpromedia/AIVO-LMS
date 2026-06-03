-- Reporting framework schema (Sprint 10).
-- reports-svc serves runs/schedules from an in-memory store (src/store.ts);
-- this migration is the authoritative schema a Postgres implementation mirrors.

BEGIN;

CREATE TABLE IF NOT EXISTS report_runs (
  id            TEXT PRIMARY KEY,
  report_id     TEXT NOT NULL,
  tenant_id     TEXT,
  format        TEXT NOT NULL CHECK (format IN ('csv','json','parquet','pdf')),
  params        JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed')),
  row_count     INTEGER,
  error         TEXT,
  cache_key     TEXT NOT NULL,
  cached        BOOLEAN NOT NULL DEFAULT FALSE,
  requested_by  TEXT NOT NULL,
  -- Object-store key (e.g. s3://…) of the rendered artifact when succeeded.
  result_uri    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_report_runs_report ON report_runs (report_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_runs_tenant ON report_runs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_runs_cache ON report_runs (cache_key);

CREATE TABLE IF NOT EXISTS report_schedules (
  id          TEXT PRIMARY KEY,
  report_id   TEXT NOT NULL,
  tenant_id   TEXT,
  params      JSONB NOT NULL DEFAULT '{}',
  cron        TEXT NOT NULL,
  recipients  JSONB NOT NULL DEFAULT '[]',
  format      TEXT NOT NULL CHECK (format IN ('csv','json','parquet','pdf')),
  created_by  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_run_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_report_schedules_tenant ON report_schedules (tenant_id);

-- Source-of-data lineage per run (services + query versions).
CREATE TABLE IF NOT EXISTS report_run_lineage (
  run_id         TEXT NOT NULL REFERENCES report_runs (id) ON DELETE CASCADE,
  report_version TEXT NOT NULL,
  service        TEXT NOT NULL,
  query          TEXT NOT NULL,
  query_version  TEXT NOT NULL,
  captured_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, service, query)
);

-- Per-tenant daily run quota counters (max 1000 runs/day; 429 on exceed).
CREATE TABLE IF NOT EXISTS report_quota_daily (
  tenant_id TEXT NOT NULL,
  day       DATE NOT NULL,
  count     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, day)
);

COMMIT;

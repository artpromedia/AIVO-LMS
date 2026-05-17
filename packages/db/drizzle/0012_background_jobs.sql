-- Sprint 7 — fleet-wide background-job ledger and history.
-- Foundation for Tasks #54..#80, #178..#180.
CREATE TABLE IF NOT EXISTS daily_job_runs (
  job_name          varchar(100) PRIMARY KEY,
  last_run_at       timestamptz NOT NULL,
  last_finished_at  timestamptz,
  last_replica_id   varchar(100),
  last_status       varchar(20),
  last_sent         integer,
  last_failed       integer,
  last_error        text,
  updated_at        timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_daily_job_runs (
  id           bigserial PRIMARY KEY,
  job_name     varchar(100) NOT NULL,
  run_at       timestamptz NOT NULL,
  finished_at  timestamptz,
  replica_id   varchar(100),
  status       varchar(20) NOT NULL,
  sent         integer,
  failed       integer,
  duration_ms  integer,
  error        text
);
CREATE INDEX IF NOT EXISTS idx_billing_daily_job_runs_job_run
  ON billing_daily_job_runs (job_name, run_at);
CREATE INDEX IF NOT EXISTS idx_billing_daily_job_runs_status
  ON billing_daily_job_runs (status);

CREATE TABLE IF NOT EXISTS periodic_job_runs (
  id           bigserial PRIMARY KEY,
  job_name     varchar(100) NOT NULL,
  run_at       timestamptz NOT NULL,
  finished_at  timestamptz,
  replica_id   varchar(100),
  status       varchar(20) NOT NULL,
  duration_ms  integer,
  error        text
);
CREATE INDEX IF NOT EXISTS idx_periodic_job_runs_job_run
  ON periodic_job_runs (job_name, run_at);
CREATE INDEX IF NOT EXISTS idx_periodic_job_runs_run_at
  ON periodic_job_runs (run_at);

CREATE TABLE IF NOT EXISTS billing_coupons (
  code            varchar(64) PRIMARY KEY,
  description     text,
  discount_pct    integer NOT NULL,
  max_redemptions integer,
  redemptions     integer NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  expires_at      timestamptz
);

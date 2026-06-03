-- SLO + error-budget schema (Sprint 8).
-- alerts-proxy-svc serves this from an in-memory store (src/slo/store.ts);
-- this migration is the authoritative schema for a Postgres implementation.

BEGIN;

CREATE TABLE IF NOT EXISTS slos (
  id              TEXT PRIMARY KEY,
  service         TEXT NOT NULL,
  tenant_id       TEXT,                 -- NULL = service-wide
  name            TEXT NOT NULL,
  target          DOUBLE PRECISION NOT NULL CHECK (target > 0 AND target < 1),
  window_days     INTEGER NOT NULL DEFAULT 30,
  indicator_query TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_slos_service ON slos (service, tenant_id);

-- Rolling observed good/bad event counts per service (+ optional tenant),
-- populated from the indicator query by a scrape job.
CREATE TABLE IF NOT EXISTS slo_observations (
  service     TEXT NOT NULL,
  tenant_id   TEXT NOT NULL DEFAULT '',  -- '' = service-wide
  good_events BIGINT NOT NULL DEFAULT 0,
  bad_events  BIGINT NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (service, tenant_id)
);

-- Dedupe ledger so restarts don't re-page on alerts already seen.
CREATE TABLE IF NOT EXISTS alert_dedupe (
  fingerprint TEXT PRIMARY KEY,
  status      TEXT NOT NULL,
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  count       INTEGER NOT NULL DEFAULT 1
);

COMMIT;

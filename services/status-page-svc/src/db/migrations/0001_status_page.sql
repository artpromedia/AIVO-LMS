-- Status-page schema (Sprint 8).
-- status-page-svc serves this from an in-memory store (src/statuspage/store.ts);
-- this migration is the authoritative schema a Postgres implementation mirrors.

BEGIN;

CREATE TABLE IF NOT EXISTS status_components (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  component_group  TEXT NOT NULL DEFAULT 'General',
  status           TEXT NOT NULL CHECK (status IN
                     ('operational','degraded_performance','partial_outage','major_outage','under_maintenance')),
  depends_on       JSONB NOT NULL DEFAULT '[]',
  affected_tenants JSONB NOT NULL DEFAULT '[]',
  display_order    INTEGER NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS status_incidents (
  id                     TEXT PRIMARY KEY,
  title                  TEXT NOT NULL,
  lifecycle              TEXT NOT NULL CHECK (lifecycle IN ('investigating','identified','monitoring','resolved')),
  impact                 TEXT NOT NULL CHECK (impact IN ('none','minor','major','critical')),
  affected_component_ids JSONB NOT NULL DEFAULT '[]',
  affected_tenants       JSONB NOT NULL DEFAULT '[]',
  postmortem_url         TEXT,
  created_by             TEXT NOT NULL,
  auto_created           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_status_incidents_lifecycle ON status_incidents (lifecycle, created_at DESC);

CREATE TABLE IF NOT EXISTS incident_updates (
  id          TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES status_incidents (id) ON DELETE CASCADE,
  lifecycle   TEXT NOT NULL,
  body        TEXT NOT NULL,
  author      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_incident_updates_incident ON incident_updates (incident_id, created_at);

CREATE TABLE IF NOT EXISTS maintenances (
  id                 TEXT PRIMARY KEY,
  title              TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  component_ids      JSONB NOT NULL DEFAULT '[]',
  state              TEXT NOT NULL CHECK (state IN ('scheduled','in_progress','completed','cancelled')),
  scheduled_start    TIMESTAMPTZ NOT NULL,
  scheduled_end      TIMESTAMPTZ NOT NULL,
  notify_lead_minutes INTEGER NOT NULL DEFAULT 60,
  created_by         TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscribers (
  id            TEXT PRIMARY KEY,
  channel       TEXT NOT NULL CHECK (channel IN ('email','webhook','rss')),
  target        TEXT NOT NULL,
  component_ids JSONB NOT NULL DEFAULT '[]',
  tenant_id     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;

-- Sprint 3 (Audit Trail) — canonical, hash-chained, append-only audit log.
--
-- Distinct from the legacy admin_audit_log (0005): this is the tamper-evident
-- `/events` store. Each row carries prev_hash + hash
-- (sha256(prev_hash || canonical(payload))); a daily anchor in audit_anchors
-- (mirrored to WORM/object-lock storage) lets us detect a full-table rewrite.
--
-- Partitioned by month on occurred_at so retention prune/archive is a fast
-- DETACH/DROP per old partition. Hot-path indexes: BRIN on occurred_at (the
-- table is naturally time-clustered), btree on tenant_id and action.

CREATE TABLE IF NOT EXISTS audit_events (
  id            uuid NOT NULL,                 -- uuidv7 (time-ordered)
  occurred_at   timestamptz NOT NULL,
  tenant_id     uuid,                           -- null = platform-global
  actor_id      varchar(128) NOT NULL,
  actor_role    varchar(48) NOT NULL,
  actor_ip      varchar(64) NOT NULL DEFAULT '',
  actor_ua      text NOT NULL DEFAULT '',
  action        varchar(128) NOT NULL,          -- dot.namespaced
  entity_type   varchar(64) NOT NULL,
  entity_id     varchar(255) NOT NULL DEFAULT '',
  outcome       varchar(16) NOT NULL,           -- success | failure
  details       jsonb NOT NULL DEFAULT '{}'::jsonb,  -- allowlist-redacted
  request_id    varchar(128) NOT NULL DEFAULT '',
  prev_hash     varchar(64) NOT NULL DEFAULT '',
  hash          varchar(64) NOT NULL,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- Bootstrap partitions (current + next month). The nightly job creates the
-- upcoming month's partition and detaches/archives partitions older than the
-- tenant's audit_retention_policy.min_days.
DO $$
DECLARE
  m0 date := date_trunc('month', now())::date;
  m1 date := (date_trunc('month', now()) + interval '1 month')::date;
  m2 date := (date_trunc('month', now()) + interval '2 months')::date;
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS audit_events_%s PARTITION OF audit_events FOR VALUES FROM (%L) TO (%L)',
    to_char(m0, 'YYYYMM'), m0, m1);
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS audit_events_%s PARTITION OF audit_events FOR VALUES FROM (%L) TO (%L)',
    to_char(m1, 'YYYYMM'), m1, m2);
END $$;

CREATE INDEX IF NOT EXISTS audit_events_occurred_brin ON audit_events USING brin (occurred_at);
CREATE INDEX IF NOT EXISTS audit_events_tenant_idx ON audit_events (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_action_idx ON audit_events (action, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_actor_idx ON audit_events (actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_entity_idx ON audit_events (entity_type, entity_id);

-- Append-only guard: block UPDATE/DELETE on the hot table (archival happens
-- via partition DETACH, not row deletes). Verification jobs read only.
CREATE OR REPLACE FUNCTION audit_events_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only (no % allowed)', TG_OP;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_no_update ON audit_events;
CREATE TRIGGER audit_events_no_update BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_block_mutation();

-- Daily tamper-evidence anchor: the chain head hash + count for a window,
-- mirrored to object-lock storage. A rewrite that fixes intra-table hashes
-- still fails to match the externally-stored anchor.
CREATE TABLE IF NOT EXISTS audit_anchors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anchored_at   timestamptz NOT NULL DEFAULT now(),
  window_start  timestamptz NOT NULL,
  window_end    timestamptz NOT NULL,
  event_count   bigint NOT NULL,
  head_hash     varchar(64) NOT NULL,
  -- Object-lock / WORM reference (e.g. s3://bucket/key + version id).
  worm_ref      text
);
CREATE INDEX IF NOT EXISTS audit_anchors_window_idx ON audit_anchors (window_end DESC);

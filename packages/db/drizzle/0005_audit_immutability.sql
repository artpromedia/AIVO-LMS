-- Sprint 4: Audit immutability + impersonation trail.
--
-- Adds chain (prevHash/hash), monotonic seq, and on-behalf-of column to all
-- three audit tables, then attaches a trigger that raises an exception on
-- any UPDATE or DELETE so rows are append-only at the database layer.
-- Idempotent — safe to re-run.

-- audit_events ------------------------------------------------------------
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS seq bigserial;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS on_behalf_of_id uuid;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS prev_hash varchar(64);
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS hash varchar(64);
CREATE INDEX IF NOT EXISTS idx_audit_events_seq ON audit_events(seq);

-- admin_audit_log ---------------------------------------------------------
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS seq bigserial;
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS on_behalf_of_id uuid REFERENCES users(id);
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS prev_hash varchar(64);
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS hash varchar(64);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_seq ON admin_audit_log(seq);

-- district_activity_log ---------------------------------------------------
ALTER TABLE district_activity_log ADD COLUMN IF NOT EXISTS seq bigserial;
ALTER TABLE district_activity_log ADD COLUMN IF NOT EXISTS on_behalf_of_id uuid REFERENCES users(id);
ALTER TABLE district_activity_log ADD COLUMN IF NOT EXISTS prev_hash varchar(64);
ALTER TABLE district_activity_log ADD COLUMN IF NOT EXISTS hash varchar(64);
CREATE INDEX IF NOT EXISTS idx_district_activity_log_seq ON district_activity_log(seq);

-- Append-only trigger -----------------------------------------------------
CREATE OR REPLACE FUNCTION audit_no_mutate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit table % is append-only — % blocked', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_no_mutate ON audit_events;
CREATE TRIGGER audit_events_no_mutate
  BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION audit_no_mutate();

DROP TRIGGER IF EXISTS admin_audit_log_no_mutate ON admin_audit_log;
CREATE TRIGGER admin_audit_log_no_mutate
  BEFORE UPDATE OR DELETE OR TRUNCATE ON admin_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_no_mutate();

DROP TRIGGER IF EXISTS district_activity_log_no_mutate ON district_activity_log;
CREATE TRIGGER district_activity_log_no_mutate
  BEFORE UPDATE OR DELETE OR TRUNCATE ON district_activity_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_no_mutate();

-- Optional dedicated writer role (defense-in-depth on top of the trigger).
-- Skipped silently if the role already exists or we lack permission.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'audit_writer') THEN
    CREATE ROLE audit_writer NOLOGIN;
  END IF;
  GRANT INSERT, SELECT ON audit_events, admin_audit_log, district_activity_log TO audit_writer;
  REVOKE UPDATE, DELETE, TRUNCATE ON audit_events, admin_audit_log, district_activity_log FROM audit_writer;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'audit_writer role grants skipped (insufficient privilege)';
END$$;

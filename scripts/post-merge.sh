#!/bin/bash
set -e

echo "=== Post-merge setup ==="

echo "Installing pnpm dependencies..."
# This post-merge runs while every dev workflow is still resident (Marketing,
# Web App, Brain, Identity, mockup-sandbox), so the container is memory- and
# thread-constrained. Two transient failure modes show up here, both resource
# spikes rather than real bugs:
#   * heap OOM aborts of parallel `tsc` lifecycle builds (exit -11 / "Aborted")
#   * inability to spawn a process/thread under momentary pressure -- e.g.
#     "Cannot fork" from a `tsc` prepare script, or a "new Worker" failure
#     during pnpm's symlinkAllModules link step. (ulimit -u is ~64k here, so
#     this is memory pressure on fork()/thread-stack alloc, not a PID cap.)
#
# --child-concurrency=1 serializes the workspace `prepare` (tsc) builds so only
# one compiler heap exists at a time (fixes the OOM-abort mode). --prefer-offline
# reuses the warm pnpm store; --reporter=append-only keeps the captured log
# small. We deliberately do NOT pass --ignore-scripts: those prepare hooks
# (package builds, Drizzle codegen) are required for downstream services to boot.
#
# The fork/Worker failures are momentary, so retry the whole install a few times
# with a growing pause, letting the competing workflow build spike pass before
# trying again. install_deps is invoked as an `until` condition, so `set -e`
# does not abort on an individual attempt's failure. The 30-min post-merge
# timeout leaves ample headroom for the retries.
#
# Root cause: this container's cgroup caps total processes at pids.max=1024 and
# the resident dev workflows already hold ~900 of them, so only ~100 PIDs are
# free. When several task merges land close together each fires its own
# post-merge install; their concurrent pnpm link-worker pools + tsc builds blow
# past the PID ceiling and every fork fails. Two mitigations:
#   1. flock mutex -- overlapping post-merge runs queue on one lock instead of
#      colliding. The wait is BOUNDED (-w): a post-merge that is cancelled
#      mid-install can leave an orphaned `pnpm install` child (reparented to
#      pid 1) that inherited this lock fd and never releases it. An unbounded
#      `flock 9` then blocks the NEXT merge forever until the platform cancels
#      it -- surfacing as "Error in river, code: CANCEL". With `-w` we wait a
#      short while for a genuine peer install, then proceed regardless so a
#      stale holder can never wedge future merges. The lock still releases
#      automatically when this process exits (no stale locks of our own).
#   2. UV_THREADPOOL_SIZE=2 -- shrink each node process's libuv thread pool
#      (default 4) so pnpm + every tsc child claim fewer of the scarce PIDs.
exec 9>/tmp/aivo-post-merge-install.lock
flock -w 120 9 || echo "install lock busy after 120s; proceeding without it." >&2
export UV_THREADPOOL_SIZE=2

install_deps() {
  pnpm install --frozen-lockfile --prefer-offline --child-concurrency=1 --reporter=append-only 2>/dev/null \
    || pnpm install --prefer-offline --child-concurrency=1 --reporter=append-only
}

attempt=1
max_attempts=4
until install_deps; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "pnpm install still failing after $max_attempts attempts; aborting." >&2
    exit 1
  fi
  backoff=$((attempt * 20))
  echo "pnpm install attempt $attempt failed (transient resource spike); retrying in ${backoff}s..." >&2
  sleep "$backoff"
  attempt=$((attempt + 1))
done

echo "Installing brain-svc Python dependencies..."
cd services/brain-svc && pip install -q -r requirements.txt 2>/dev/null; cd ../..

echo "Pushing database schema..."
pnpm --filter @aivo/db run db:push --force 2>/dev/null || true

echo "Ensuring critical tables exist (idempotent SQL fallback)..."
if [ -n "$DATABASE_URL" ]; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=0 <<'SQL' 2>/dev/null || true
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  token_hash varchar(128) NOT NULL,
  expires_at timestamp NOT NULL,
  used_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_token_hash_idx ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens(user_id);

-- Sprint 2: Phishing-resistant MFA
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret_encrypted text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_locked_until timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_failed_attempts integer DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_failed_last_at timestamp;

ALTER TABLE mfa_codes ADD COLUMN IF NOT EXISTS code_hash varchar(64);
UPDATE mfa_codes SET code_hash = encode(sha256(code::bytea), 'hex')
  WHERE code_hash IS NULL AND code IS NOT NULL;
ALTER TABLE mfa_codes ALTER COLUMN code DROP NOT NULL;
DELETE FROM mfa_codes WHERE code_hash IS NULL;
ALTER TABLE mfa_codes ALTER COLUMN code_hash SET NOT NULL;
ALTER TABLE mfa_codes DROP COLUMN IF EXISTS code;

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint DEFAULT 0 NOT NULL,
  transports text,
  label varchar(120) DEFAULT 'Passkey' NOT NULL,
  device_type varchar(32),
  backed_up boolean DEFAULT false,
  created_at timestamp DEFAULT now() NOT NULL,
  last_used_at timestamp
);
CREATE INDEX IF NOT EXISTS webauthn_credentials_user_id_idx ON webauthn_credentials(user_id);

CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  code_hash text NOT NULL,
  used_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS mfa_recovery_codes_user_id_idx ON mfa_recovery_codes(user_id);

-- Sprint 4: Audit immutability + impersonation trail
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS seq bigserial;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS on_behalf_of_id uuid;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS prev_hash varchar(64);
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS hash varchar(64);
CREATE INDEX IF NOT EXISTS idx_audit_events_seq ON audit_events(seq);

ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS seq bigserial;
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS on_behalf_of_id uuid REFERENCES users(id);
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS prev_hash varchar(64);
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS hash varchar(64);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_seq ON admin_audit_log(seq);

ALTER TABLE district_activity_log ADD COLUMN IF NOT EXISTS seq bigserial;
ALTER TABLE district_activity_log ADD COLUMN IF NOT EXISTS on_behalf_of_id uuid REFERENCES users(id);
ALTER TABLE district_activity_log ADD COLUMN IF NOT EXISTS prev_hash varchar(64);
ALTER TABLE district_activity_log ADD COLUMN IF NOT EXISTS hash varchar(64);
CREATE INDEX IF NOT EXISTS idx_district_activity_log_seq ON district_activity_log(seq);

CREATE OR REPLACE FUNCTION audit_no_mutate() RETURNS trigger AS $aivo$
BEGIN
  RAISE EXCEPTION 'Audit table % is append-only -- % blocked', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$aivo$ LANGUAGE plpgsql;
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

-- Sprint 5: Admin session hygiene
CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  session_id varchar(64) NOT NULL UNIQUE,
  last_activity_at timestamp DEFAULT now() NOT NULL,
  mfa_verified_at timestamp DEFAULT now() NOT NULL,
  device_fingerprint varchar(64) NOT NULL,
  ip_address varchar(45),
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_activity ON admin_sessions(last_activity_at);

-- Sprint 6: SCIM tokens + SAML/SCIM provenance markers.
CREATE TABLE IF NOT EXISTS scim_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  token_hash varchar(64) NOT NULL UNIQUE,
  prefix varchar(16) NOT NULL,
  name varchar(255) NOT NULL,
  created_by uuid REFERENCES users(id),
  last_used_at timestamp,
  revoked_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scim_tokens_tenant ON scim_tokens(tenant_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS provisioned_by varchar(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS external_id varchar(255);

-- Sprint 7: password policy + rotation + history.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamp DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
UPDATE users SET password_changed_at = COALESCE(password_changed_at, created_at)
  WHERE password_changed_at IS NULL;

CREATE TABLE IF NOT EXISTS password_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  password_hash text NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id, created_at);

-- Sprint 7: API key rotation grace window.
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rotated_from_id uuid;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamp;
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);

-- Sprint 8: Delegated district admin invites.
CREATE TABLE IF NOT EXISTS district_admin_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  email varchar(255) NOT NULL,
  name varchar(255) NOT NULL,
  invited_by uuid NOT NULL REFERENCES users(id),
  token_hash varchar(128) NOT NULL,
  expires_at timestamp NOT NULL,
  accepted_at timestamp,
  accepted_user_id uuid REFERENCES users(id),
  revoked_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_district_admin_invites_tenant ON district_admin_invites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_district_admin_invites_token ON district_admin_invites(token_hash);

-- Sprint 9: seat self-service requests.
CREATE TABLE IF NOT EXISTS seat_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  requested_by uuid NOT NULL REFERENCES users(id),
  current_seats integer NOT NULL,
  requested_seats integer NOT NULL,
  justification text,
  status varchar(32) DEFAULT 'pending' NOT NULL,
  resolved_at timestamp,
  resolved_by uuid REFERENCES users(id),
  resolution_notes text,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_seat_requests_tenant ON seat_requests(tenant_id, created_at);

-- Sprint 11: SOC 2 evidence bundle metadata.
CREATE TABLE IF NOT EXISTS evidence_bundles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bundle_date varchar(10) NOT NULL UNIQUE,
  filename varchar(255) NOT NULL,
  size_bytes integer NOT NULL,
  sha256 varchar(64) NOT NULL,
  summary jsonb NOT NULL,
  generated_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evidence_bundles_date ON evidence_bundles(bundle_date);
SQL
fi

echo "=== Post-merge setup complete ==="

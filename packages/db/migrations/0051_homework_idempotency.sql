BEGIN;

ALTER TABLE homework_sessions
  ADD COLUMN IF NOT EXISTS runtime_state JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS idempotency_keys (
  tenant_id TEXT NOT NULL,
  route TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  response_body JSONB NOT NULL,
  response_status INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT idempotency_keys_tenant_route_key_uq
    UNIQUE (tenant_id, route, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idempotency_keys_expires_at_idx
  ON idempotency_keys(expires_at);

COMMIT;

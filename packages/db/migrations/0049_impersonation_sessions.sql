-- Secure impersonation ("View As") sessions — Sprint 9.
-- One row per impersonation grant; immutable except ended_at.

BEGIN;

CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id                UUID NOT NULL REFERENCES users (id),
  subject_id              UUID NOT NULL REFERENCES users (id),
  tenant_id               UUID REFERENCES tenants (id),
  started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at                 TIMESTAMPTZ NOT NULL,
  ended_at                TIMESTAMPTZ,
  reason                  TEXT NOT NULL,
  allow_writes            BOOLEAN NOT NULL DEFAULT FALSE,
  -- Documented legal/operational basis recorded at start:
  -- SUBJECT_CONSENT | GUARDIAN_CONSENT | JUSTIFICATION_TICKET | OPEN_INCIDENT
  -- | PLATFORM_OVERRIDE | BREAK_GLASS
  consent_basis           VARCHAR(40),
  ip                      VARCHAR(45),
  ua                      TEXT,
  justification_ticket_id VARCHAR(128),

  CONSTRAINT impersonation_no_self CHECK (actor_id <> subject_id)
);

CREATE INDEX IF NOT EXISTS idx_impersonation_actor ON impersonation_sessions (actor_id, started_at);
CREATE INDEX IF NOT EXISTS idx_impersonation_subject ON impersonation_sessions (subject_id);
-- Partial index over still-open sessions for the hot "active session" lookup.
CREATE INDEX IF NOT EXISTS idx_impersonation_active ON impersonation_sessions (actor_id)
  WHERE ended_at IS NULL;

COMMIT;

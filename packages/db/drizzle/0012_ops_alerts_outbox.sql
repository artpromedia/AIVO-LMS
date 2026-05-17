-- Durable on-call alert outbox shared across services that use OpsAlertClient
-- with the Postgres-backed store. One row per envelope. Drained by
-- PostgresOpsAlertOutboxStore.drain() (see packages/ops-alerts).
CREATE TABLE IF NOT EXISTS "ops_alerts_outbox" (
  "id" UUID PRIMARY KEY,
  "service" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "occurred_at" TIMESTAMPTZ NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ops_alerts_outbox_service_idx" ON "ops_alerts_outbox" ("service");
CREATE INDEX IF NOT EXISTS "ops_alerts_outbox_occurred_at_idx" ON "ops_alerts_outbox" ("occurred_at");

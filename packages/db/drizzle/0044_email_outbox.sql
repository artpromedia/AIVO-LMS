-- Durable transactional-email outbox for comms-svc.
--
-- Every call to sendEmail()/sendTemplateEmail() persists a row here before
-- the Postmark API is touched. A drain worker in comms-svc reserves pending
-- rows with `SELECT ... FOR UPDATE SKIP LOCKED`, calls Postmark, and writes
-- the outcome back. Failed sends are retried with exponential backoff until
-- max_attempts is reached, at which point the row is moved to dead_letter.
--
-- The Postmark webhook (POST /api/comms/webhook/email-events) reconciles
-- bounces and spam complaints by updating rows whose provider_message_id
-- matches the MessageID Postmark returns.
CREATE TABLE IF NOT EXISTS "email_outbox" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "dedupe_key" TEXT,
  "send_kind" TEXT NOT NULL DEFAULT 'raw',
  "to_email" TEXT NOT NULL,
  "subject" TEXT,
  "html_body" TEXT,
  "text_body" TEXT,
  "template_alias" TEXT,
  "template_model" JSONB,
  "tag" TEXT,
  "reply_to" TEXT,
  "metadata" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 6,
  "next_retry_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "last_error" TEXT,
  "provider_message_id" TEXT,
  "tenant_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "sent_at" TIMESTAMPTZ,
  "failed_at" TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_outbox_dedupe_key_uidx"
  ON "email_outbox" ("dedupe_key")
  WHERE "dedupe_key" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "email_outbox_pending_idx"
  ON "email_outbox" ("next_retry_at")
  WHERE "status" IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS "email_outbox_provider_message_id_idx"
  ON "email_outbox" ("provider_message_id")
  WHERE "provider_message_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "email_outbox_status_idx"
  ON "email_outbox" ("status");

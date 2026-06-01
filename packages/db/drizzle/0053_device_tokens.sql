-- Push device-token registry (comms-svc). Maps an owning user to their FCM/
-- APNs device tokens so user-addressed push can resolve userId -> tokens.
-- `token` is globally unique; re-register upserts by token.

CREATE TABLE IF NOT EXISTS "device_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "token" text NOT NULL UNIQUE,
  "kind" varchar(8) NOT NULL,
  "platform" varchar(16),
  "topic" varchar(255),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "device_tokens_user_idx" ON "device_tokens" ("user_id");

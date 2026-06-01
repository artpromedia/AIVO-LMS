-- Unified inbox / threaded messaging (the /messages surface). A thread groups
-- a few participants around an optional learner; messages belong to a thread;
-- per-participant last_read_at drives unread counts.

CREATE TABLE IF NOT EXISTS "message_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL,
  "subject" varchar(200) NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "learner_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_message_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "message_threads_tenant_idx" ON "message_threads" ("tenant_id");

CREATE TABLE IF NOT EXISTS "message_thread_participants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "thread_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "last_read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "message_thread_participants_thread_user_key" UNIQUE ("thread_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "message_thread_participants_user_idx" ON "message_thread_participants" ("user_id");
CREATE INDEX IF NOT EXISTS "message_thread_participants_thread_idx" ON "message_thread_participants" ("thread_id");

CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "thread_id" uuid NOT NULL,
  "sender_user_id" uuid NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "messages_thread_idx" ON "messages" ("thread_id");

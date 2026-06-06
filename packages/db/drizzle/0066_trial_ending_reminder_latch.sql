-- Idempotency latch for the daily trial-ending reminder job. Idempotent so it
-- is safe against dev DBs bootstrapped via db:push.
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "trial_ending_reminder_sent_at" timestamp;

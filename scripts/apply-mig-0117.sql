-- Migration 0117: learner_pin_credentials (Argon2id learner PIN store).
-- Safe to apply anytime — additive, no dependency on app version.
CREATE TABLE IF NOT EXISTS "learner_pin_credentials" (
  "learner_user_id" uuid PRIMARY KEY REFERENCES "users"("id"),
  "pin_hash" text NOT NULL,
  "pin_set_at" timestamp DEFAULT now() NOT NULL,
  "failed_attempts" integer DEFAULT 0 NOT NULL,
  "failed_last_at" timestamp,
  "locked_until" timestamp,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "learner_pin_credentials_locked_until_idx"
  ON "learner_pin_credentials" ("locked_until");
CREATE INDEX IF NOT EXISTS "learner_pin_credentials_updated_at_idx"
  ON "learner_pin_credentials" ("updated_at");

SELECT 'learner_pin_credentials=' ||
  CASE WHEN to_regclass('public.learner_pin_credentials') IS NULL THEN 'MISSING' ELSE 'ok' END;
SELECT 'users_pin_col_still_present=' || count(*)
  FROM information_schema.columns WHERE table_name='users' AND column_name='pin';

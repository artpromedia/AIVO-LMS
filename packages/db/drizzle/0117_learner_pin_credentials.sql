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

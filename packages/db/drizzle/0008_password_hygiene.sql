-- Sprint 7: password policy + rotation + history.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_changed_at" timestamp DEFAULT now();
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "password_history" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "password_hash" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_password_history_user"
  ON "password_history" ("user_id", "created_at");

-- Backfill: existing accounts get passwordChangedAt = createdAt so the
-- 365-day rotation clock starts fairly rather than from the migration moment.
UPDATE "users" SET "password_changed_at" = COALESCE("password_changed_at", "created_at")
  WHERE "password_changed_at" IS NULL;

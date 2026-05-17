-- Sprint 2: Phishing-resistant MFA (TOTP + WebAuthn passkeys + recovery codes,
-- email OTP hashed at rest). Idempotent — safe to re-run.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_secret_encrypted" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_locked_until" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_failed_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_failed_last_at" timestamp;--> statement-breakpoint

ALTER TABLE "mfa_codes" ADD COLUMN IF NOT EXISTS "code_hash" varchar(64);--> statement-breakpoint
-- Backfill + cleanup gated on the legacy "code" column still existing.
-- A dev DB bootstrapped via `db:push` will already be in the post-drop
-- shape; running these statements unconditionally would crash with
-- `column "code" does not exist`. The guard makes db:migrate idempotent.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mfa_codes' AND column_name = 'code'
  ) THEN
    UPDATE "mfa_codes" SET "code_hash" = encode(sha256("code"::bytea), 'hex') WHERE "code_hash" IS NULL AND "code" IS NOT NULL;
    EXECUTE 'ALTER TABLE "mfa_codes" ALTER COLUMN "code" DROP NOT NULL';
    DELETE FROM "mfa_codes" WHERE "code_hash" IS NULL;
  END IF;
END $$;--> statement-breakpoint
-- After the (possibly skipped) backfill, code_hash is the source of
-- truth and must be NOT NULL. Wrap in DO so re-running on a DB where
-- the constraint already exists is a no-op.
DO $$ BEGIN
  ALTER TABLE "mfa_codes" ALTER COLUMN "code_hash" SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;--> statement-breakpoint
ALTER TABLE "mfa_codes" DROP COLUMN IF EXISTS "code";--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "webauthn_credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "credential_id" text NOT NULL,
  "public_key" text NOT NULL,
  "counter" bigint DEFAULT 0 NOT NULL,
  "transports" text,
  "label" varchar(120) DEFAULT 'Passkey' NOT NULL,
  "device_type" varchar(32),
  "backed_up" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_used_at" timestamp,
  CONSTRAINT "webauthn_credentials_credential_id_unique" UNIQUE("credential_id")
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webauthn_credentials_user_id_idx" ON "webauthn_credentials"("user_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "mfa_recovery_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "code_hash" text NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mfa_recovery_codes_user_id_idx" ON "mfa_recovery_codes"("user_id");

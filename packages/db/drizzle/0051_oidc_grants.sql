-- Phase 2 (multi-replica) — move OIDC ephemeral grant state out of the
-- single-replica in-memory Maps and into Postgres. Only SHA-256 hashes of
-- the codes/tokens are stored (never the raw values), mirroring how
-- sessions.refresh_token / password_reset_tokens are handled.

CREATE TABLE IF NOT EXISTS "oidc_auth_codes" (
  "code_hash" varchar(64) PRIMARY KEY,
  "client_id" text NOT NULL,
  "redirect_uri" text NOT NULL,
  "scope" text NOT NULL,
  "user_id" uuid NOT NULL,
  "code_challenge" text NOT NULL,
  "nonce" text,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "oidc_auth_codes_expires_idx" ON "oidc_auth_codes" ("expires_at");

CREATE TABLE IF NOT EXISTS "oidc_access_tokens" (
  "token_hash" varchar(64) PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "client_id" text NOT NULL,
  "scope" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "oidc_access_tokens_expires_idx" ON "oidc_access_tokens" ("expires_at");

CREATE TABLE IF NOT EXISTS "oidc_refresh_tokens" (
  "token_hash" varchar(64) PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "client_id" text NOT NULL,
  "scope" text NOT NULL,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "oidc_refresh_tokens_expires_idx" ON "oidc_refresh_tokens" ("expires_at");

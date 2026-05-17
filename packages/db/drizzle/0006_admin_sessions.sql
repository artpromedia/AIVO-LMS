-- Sprint 5: per-admin-session activity tracker. Used by /api/auth/refresh
-- to enforce idle timeout, MFA-freshness window, and device-fingerprint
-- binding for internal-role users. session_id holds the same hashed
-- refresh token as `sessions.refresh_token` so the join is implicit.
CREATE TABLE IF NOT EXISTS "admin_sessions" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "session_id" varchar(64) NOT NULL UNIQUE,
  "last_activity_at" timestamp NOT NULL DEFAULT now(),
  "mfa_verified_at" timestamp NOT NULL DEFAULT now(),
  "device_fingerprint" varchar(64) NOT NULL,
  "ip_address" varchar(45),
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_admin_sessions_user" ON "admin_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_admin_sessions_activity" ON "admin_sessions" ("last_activity_at");

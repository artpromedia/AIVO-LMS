-- Sprint task #13 / Phase D: secure parent share links for finalised IEPs.
-- Parents sometimes need to share the finalised IEP with someone outside
-- AIVO (private tutor, outside therapist, non-custodial parent without a
-- team seat). A signed share token gives that recipient a read-only
-- parent-summary view of the IEP without granting an account.
--
-- Token plaintext is shown to the issuer once at creation; only its
-- sha-256 hash is persisted. ON DELETE CASCADE on the FK so dropping a
-- profile sweeps any outstanding share links automatically.
--
-- Idempotent: CREATE TABLE / CREATE UNIQUE INDEX both gated by IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "iep_parent_share_links" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "iep_profile_id" uuid NOT NULL
    REFERENCES "iep_profiles"("id") ON DELETE CASCADE,
  "token_hash" varchar(64) NOT NULL,
  "label" varchar(120),
  "issued_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  "last_accessed_at" timestamp,
  "access_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "iep_parent_share_links_token_hash_uidx"
  ON "iep_parent_share_links" ("token_hash");

CREATE INDEX IF NOT EXISTS "iep_parent_share_links_profile_idx"
  ON "iep_parent_share_links" ("iep_profile_id");

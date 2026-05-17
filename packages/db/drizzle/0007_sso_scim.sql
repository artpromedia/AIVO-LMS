-- Sprint 6: SAML SSO + SCIM 2.0 provisioning.
-- ssoConfig already lives in district_settings.sso_config (jsonb).
-- We add per-tenant SCIM bearer tokens here; SAML config is held in jsonb.

CREATE TABLE IF NOT EXISTS "scim_tokens" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "token_hash" varchar(64) NOT NULL UNIQUE,
  "prefix" varchar(16) NOT NULL,
  "name" varchar(255) NOT NULL,
  "created_by" uuid REFERENCES "users"("id"),
  "last_used_at" timestamp,
  "revoked_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_scim_tokens_tenant" ON "scim_tokens" ("tenant_id");

-- SCIM/SAML provenance markers on users so an admin can see which accounts
-- were JIT'd vs. directly created.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "provisioned_by" varchar(20);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "external_id" varchar(255);

-- API-key rotation grace window (Sprint 7 lives alongside since the api_keys
-- table is already there and these columns are independent of password work).
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "rotated_from_id" uuid;
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "grace_period_ends_at" timestamp;
CREATE INDEX IF NOT EXISTS "idx_api_keys_prefix" ON "api_keys" ("key_prefix");
CREATE INDEX IF NOT EXISTS "idx_api_keys_tenant" ON "api_keys" ("tenant_id");

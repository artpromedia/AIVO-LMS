-- TTS pronunciation overrides — admin-curated token→replacement dictionary
-- for the read-aloud TTS adapter. Owned by admin-svc, surfaced in the
-- web-admin platform console. Additive only.

CREATE TABLE IF NOT EXISTS "pronunciation_overrides" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID,
  "token" VARCHAR(256) NOT NULL,
  "replacement" VARCHAR(512) NOT NULL,
  "encoding" VARCHAR(16) NOT NULL DEFAULT 'plain',
  "scope" VARCHAR(16) NOT NULL DEFAULT 'tenant',
  "notes" TEXT,
  "created_by_user_id" UUID,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pronunciation_overrides_tenant" ON "pronunciation_overrides" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pronunciation_overrides_token" ON "pronunciation_overrides" ("token");

-- Sprint 5 (production readiness) — durable Content CMS pack registry.
--
-- Replaces admin-svc's process-local Map so validate/publish state survives a
-- restart and is shared across replicas. `pack_key` is the logical pack id the
-- API addresses; `pack` holds the full authored ContentPack JSON. `tenant_id`
-- is nullable for platform-global packs.

CREATE TABLE IF NOT EXISTS "content_packs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pack_key" varchar(200) NOT NULL,
  "tenant_id" uuid,
  "title" varchar(255) NOT NULL,
  "version" varchar(40) NOT NULL,
  "subject" varchar(100) NOT NULL,
  "grade_band" varchar(40) NOT NULL,
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "pack" jsonb NOT NULL,
  "last_validation" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "content_packs_pack_key_unique" UNIQUE ("pack_key")
);
CREATE INDEX IF NOT EXISTS "content_packs_status_idx" ON "content_packs" ("status");

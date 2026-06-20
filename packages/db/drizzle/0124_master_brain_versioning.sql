-- P3: revive brain_seed_templates as the versioned "master brain" store.
-- Add a monotonic version (lineage links here) and the KT priors the model cold-starts from.
ALTER TABLE "brain_seed_templates" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "brain_seed_templates" ADD COLUMN IF NOT EXISTS "kt_priors" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_brain_seed_templates_level_version" ON "brain_seed_templates" USING btree ("functioning_level","version");

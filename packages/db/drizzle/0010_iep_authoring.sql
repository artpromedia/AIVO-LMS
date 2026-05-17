-- Phase B: IEP authoring inside AIVO.
-- Extends iep_profiles with lifecycle/source columns and adds present-levels + services tables.

ALTER TABLE "iep_profiles"
  ADD COLUMN IF NOT EXISTS "source" varchar(20) NOT NULL DEFAULT 'uploaded',
  ADD COLUMN IF NOT EXISTS "lifecycle_state" varchar(20) NOT NULL DEFAULT 'finalised',
  ADD COLUMN IF NOT EXISTS "authored_by_user_id" uuid REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "from_evaluation_id" uuid,
  ADD COLUMN IF NOT EXISTS "placement" varchar(100);

CREATE INDEX IF NOT EXISTS "idx_iep_profiles_learner_lifecycle"
  ON "iep_profiles" ("learner_id", "lifecycle_state");

CREATE TABLE IF NOT EXISTS "iep_present_levels" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "iep_profile_id" uuid NOT NULL REFERENCES "iep_profiles"("id"),
  "area" varchar(30) NOT NULL,
  "narrative" text,
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_iep_present_levels_profile"
  ON "iep_present_levels" ("iep_profile_id");

CREATE TABLE IF NOT EXISTS "iep_services" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "iep_profile_id" uuid NOT NULL REFERENCES "iep_profiles"("id"),
  "service_type" varchar(60) NOT NULL,
  "provider_role" varchar(60),
  "minutes_per_week" integer,
  "frequency" varchar(60),
  "location" varchar(60),
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_iep_services_profile"
  ON "iep_services" ("iep_profile_id");

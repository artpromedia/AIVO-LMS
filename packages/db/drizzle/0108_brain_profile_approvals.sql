-- Sprint C-06 — the approval ceremony.
--
-- 1. Add a monotonic `revision` to learner_brain_profiles (the approval
--    record keys off it so a stored approval names the exact profile the
--    parent reviewed). Backfill existing rows to 1.
-- 2. Create brain_profile_approvals: the dedicated, append-only record of a
--    parent approving / amending / declining a child's learning profile —
--    actor, action, consent version, RAI version, reviewed profile revision,
--    folded modifications, and a hashed request IP — instead of burying
--    consent in display JSON. TEXT ids (no FK), ISO-8601 TEXT timestamps,
--    JSONB for the variable-shape modifications payload.

ALTER TABLE "learner_brain_profiles" ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brain_profile_approvals" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "learner_id" TEXT NOT NULL,
  "brain_profile_id" TEXT NOT NULL,
  "profile_revision" INTEGER NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "consent_version" TEXT NOT NULL,
  "rai_version" TEXT NOT NULL,
  "modifications" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "ip_hash" TEXT,
  "created_at" TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brain_profile_approvals_learner_idx" ON "brain_profile_approvals" ("learner_id", "tenant_id");

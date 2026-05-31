-- Learner brain-profile persistence — backs BrainProfileStore so
-- AIVO_PERSISTENCE_BRAIN_PROFILES=postgres can replace the in-memory store.
-- Web-domain lifecycle object (pre_clone → cloned → approved); separate
-- from brain-svc's canonical brain_states. TEXT ids (no FK), ISO-8601
-- TEXT timestamps, state in JSONB.

CREATE TABLE IF NOT EXISTS "learner_brain_profiles" (
  "id" TEXT PRIMARY KEY,
  "learner_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "approval_status" TEXT,
  "clone_stage" TEXT,
  "approved_by_parent" BOOLEAN NOT NULL DEFAULT false,
  "cloned_at" TEXT,
  "generated_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "state" JSONB NOT NULL DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learner_brain_profiles_learner_idx" ON "learner_brain_profiles" ("learner_id", "tenant_id");

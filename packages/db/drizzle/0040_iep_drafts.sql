-- Sprint 6 — AI-drafted IEPs derived from the baseline + parent
-- assessment. Lifecycle: ai_draft → teacher_review → admin_approved
-- → active → archived. One row per learner; regenerations upsert.
CREATE TABLE IF NOT EXISTS "iep_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid REFERENCES "tenants"("id"),
  "learner_id" uuid NOT NULL REFERENCES "learners"("id"),
  "source_attempt_id" uuid REFERENCES "assessment_attempts"("id"),
  "status" varchar(32) NOT NULL DEFAULT 'ai_draft',
  "draft" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "model" varchar(64),
  "responsible_ai" jsonb DEFAULT '{}'::jsonb,
  "generated_at" timestamp NOT NULL DEFAULT now(),
  "reviewed_by_user_id" uuid REFERENCES "users"("id"),
  "reviewed_at" timestamp,
  "approved_by_user_id" uuid REFERENCES "users"("id"),
  "approved_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "iep_drafts_learner_uidx"
  ON "iep_drafts" ("learner_id");
CREATE INDEX IF NOT EXISTS "iep_drafts_status_idx"
  ON "iep_drafts" ("status", "updated_at" DESC);

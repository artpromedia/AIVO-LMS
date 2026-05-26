-- Sprint 4 — responsible-AI audit verdicts for baseline items.
-- One row per (learner, question) pair per generation attempt.
CREATE TABLE IF NOT EXISTS "baseline_item_audits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid REFERENCES "tenants"("id"),
  "learner_id" uuid NOT NULL REFERENCES "learners"("id"),
  "question_id" varchar(200) NOT NULL,
  "subject" varchar(32) NOT NULL,
  "source" varchar(16) NOT NULL DEFAULT 'ai',
  "recommended_action" varchar(16) NOT NULL,
  "severity" varchar(16) NOT NULL DEFAULT 'none',
  "shipped" varchar(8) NOT NULL DEFAULT 'yes',
  "violations" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "baseline_item_audits_learner_idx"
  ON "baseline_item_audits" ("learner_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "baseline_item_audits_action_idx"
  ON "baseline_item_audits" ("recommended_action", "created_at" DESC);

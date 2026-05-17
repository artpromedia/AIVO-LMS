-- Phase A: Eligibility/Evaluation workflow.
-- Creates the iep_evaluations table referenced by assessment-svc and identity-svc.

CREATE TABLE IF NOT EXISTS "iep_evaluations" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "learner_id" uuid NOT NULL REFERENCES "learners"("id"),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "initiated_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "status" varchar(20) NOT NULL DEFAULT 'draft',
  "referral_reason" text,
  "assessment_areas" jsonb DEFAULT '[]'::jsonb,
  "observations" text,
  "parent_input" text,
  "ai_suggestion" jsonb,
  "decision_eligible" varchar(20),
  "decision_categories" jsonb DEFAULT '[]'::jsonb,
  "decision_rationale" text,
  "decided_at" timestamp,
  "decided_by_user_id" uuid REFERENCES "users"("id"),
  "submitted_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_iep_evaluations_learner"
  ON "iep_evaluations" ("learner_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_iep_evaluations_tenant_status"
  ON "iep_evaluations" ("tenant_id", "status");

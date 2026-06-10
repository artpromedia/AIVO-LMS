-- 0097_therapist_assessments.sql
--
-- Therapist-led intake feeding the adaptive baseline generator
-- (adaptive-learning E2E Sprint 6). Mirrors teacher_assessments.

CREATE TABLE IF NOT EXISTS "therapist_assessments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "learner_id" uuid NOT NULL REFERENCES "learners"("id"),
  "submitted_by" uuid REFERENCES "users"("id"),
  "therapy_discipline" varchar(30),
  "areas_of_focus" jsonb DEFAULT '[]',
  "strengths" jsonb DEFAULT '[]',
  "challenges" jsonb DEFAULT '[]',
  "sensory_notes" text,
  "communication_notes" text,
  "regulation_strategies" jsonb DEFAULT '[]',
  "recommended_accommodations" jsonb DEFAULT '[]',
  "observations" text,
  "responses" jsonb DEFAULT '{}',
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "therapist_assessments_learner_idx" ON "therapist_assessments" ("learner_id", "tenant_id");

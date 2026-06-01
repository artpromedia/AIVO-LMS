-- Phase 3 — canonical migration for the recommendations-v2 tables.
--
-- These tables back DrizzleRecommendationStore (recommendation-svc), which is
-- now wired into the routes whenever DATABASE_URL is set. They previously
-- existed only in packages/db/migrations/enterprise_recommendations_v2.sql,
-- which the canonical `db:migrate` runner (drizzle folder) does not apply —
-- so a standard production deploy would lack them and inserts would fail.
-- IF NOT EXISTS keeps this safe where the enterprise_*.sql variant already ran.

CREATE TABLE IF NOT EXISTS "profile_recommendations_v2" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "learner_id" uuid NOT NULL,
  "tenant_id" uuid,
  "type" varchar(80) NOT NULL,
  "title" text NOT NULL,
  "parent_summary" text NOT NULL,
  "current_value" jsonb,
  "proposed_value" jsonb,
  "amended_value" jsonb,
  "confidence" real NOT NULL,
  "evidence_json" jsonb DEFAULT '[]'::jsonb,
  "requires_parent_approval" boolean NOT NULL DEFAULT true,
  "affects_iep" boolean NOT NULL DEFAULT false,
  "affects_instructional_access" boolean NOT NULL DEFAULT false,
  "reversible" boolean NOT NULL DEFAULT true,
  "status" varchar(30) NOT NULL DEFAULT 'PENDING',
  "decline_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "applied_at" timestamp
);
CREATE INDEX IF NOT EXISTS "idx_recommendations_v2_learner" ON "profile_recommendations_v2" ("learner_id");
CREATE INDEX IF NOT EXISTS "idx_recommendations_v2_status" ON "profile_recommendations_v2" ("status");
CREATE INDEX IF NOT EXISTS "idx_recommendations_v2_type" ON "profile_recommendations_v2" ("type");
CREATE INDEX IF NOT EXISTS "idx_recommendations_v2_tenant" ON "profile_recommendations_v2" ("tenant_id");

CREATE TABLE IF NOT EXISTS "profile_recommendation_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "recommendation_id" uuid NOT NULL,
  "learner_id" uuid NOT NULL,
  "before_json" jsonb DEFAULT '{}'::jsonb,
  "after_json" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_recommendation_snapshots_rec" ON "profile_recommendation_snapshots" ("recommendation_id");
CREATE INDEX IF NOT EXISTS "idx_recommendation_snapshots_learner" ON "profile_recommendation_snapshots" ("learner_id");

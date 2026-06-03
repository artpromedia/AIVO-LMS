-- 0061_teacher_insights.sql
--
-- Dedicated teacher-insight surface backing:
--   - POST /api/family/teacher-insights      (family-svc, mobile + web)
--   - POST /api/bff/teacher/insights         (web-v2 BFF, ADR 0009 dual-path)
--   - apps/mobile/app/(teacher)/student/[id]/insight.tsx
--
-- The family-svc handler also mirrors each row into `brain_insights`
-- (source = "teacher") in the same transaction so existing readers of the
-- learner brain profile keep working without a migration sweep.
--
-- See packages/db/src/schema/teacher_insights.ts for the drizzle definition.

CREATE TABLE IF NOT EXISTS "teacher_insights" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "learner_id" uuid NOT NULL REFERENCES "learners"("id"),
  "teacher_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "insight_text" text NOT NULL,
  "domain" varchar(100),
  "status" varchar(32) DEFAULT 'open' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_teacher_insights_learner"
  ON "teacher_insights" ("learner_id", "created_at");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_teacher_insights_tenant"
  ON "teacher_insights" ("tenant_id", "created_at");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_teacher_insights_teacher"
  ON "teacher_insights" ("teacher_user_id", "created_at");

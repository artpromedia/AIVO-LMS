-- Teacher-authored lesson assignments — backs the teacher assignment
-- list + create screens (mobile + web). Canonical uuid-keyed table owned
-- by learning-svc. Named teacher_lesson_assignments to avoid collision
-- with the teacher↔class join table (tenancy schema).

CREATE TABLE IF NOT EXISTS "teacher_lesson_assignments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id"),
  "teacher_id" UUID NOT NULL REFERENCES "users"("id"),
  "title" VARCHAR(255) NOT NULL,
  "subject" VARCHAR(100) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "due_date" VARCHAR(32),
  "learner_ids" JSONB DEFAULT '[]'::jsonb,
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teacher_lesson_assignments_teacher_idx" ON "teacher_lesson_assignments" ("teacher_id", "tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teacher_lesson_assignments_tenant_idx" ON "teacher_lesson_assignments" ("tenant_id");

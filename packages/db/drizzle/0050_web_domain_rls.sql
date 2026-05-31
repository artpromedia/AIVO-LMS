-- Multi-tenant row-level security for the persistence-layer tables
-- (implements ADR 0002). Defense-in-depth: even if an app-layer
-- `WHERE tenant_id` is missing, the database filters cross-tenant rows.
--
-- Policy keys off the per-connection GUC `app.current_tenant`, set in a
-- transaction by withTenantContext(). The TABLE OWNER bypasses RLS
-- (migrations, seed, cross-tenant analytics); application traffic runs
-- as the non-owner role `aivo_app`, for which the policy is enforced.
--
-- Reference data (subjects, skills, quest worlds, policy versions,
-- subprocessors), cross-tenant join/identity tables (web_users,
-- web_memberships), the platform audit log, and tenant-less child
-- tables (web_baseline_questions, web_notification_deliveries) are
-- intentionally NOT protected here — they are global or governed by a
-- privileged role.

-- Non-owner application role. NOLOGIN group role; grant it to the
-- concrete login role in each environment, and point the app's
-- DATABASE_URL at that login role to enforce RLS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aivo_app') THEN
    CREATE ROLE aivo_app NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO aivo_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aivo_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aivo_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aivo_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO aivo_app;
--> statement-breakpoint
ALTER TABLE "web_notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_notifications";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_notifications"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "web_learner_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_learner_profiles";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_learner_profiles"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "web_parent_learner_relationships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_parent_learner_relationships";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_parent_learner_relationships"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "web_parent_assessments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_parent_assessments";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_parent_assessments"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "web_baseline_assessments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_baseline_assessments";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_baseline_assessments"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "web_baseline_attempts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_baseline_attempts";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_baseline_attempts"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "web_baseline_telemetry" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_baseline_telemetry";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_baseline_telemetry"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "web_mastery_maps" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_mastery_maps";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_mastery_maps"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "web_skill_masteries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_skill_masteries";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_skill_masteries"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "web_learning_paths" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_learning_paths";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_learning_paths"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "web_consent_records" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_consent_records";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_consent_records"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "web_iep_documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_iep_documents";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_iep_documents"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "web_age_gate_records" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_age_gate_records";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_age_gate_records"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "web_quest_progress" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_quest_progress";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_quest_progress"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "web_schools" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_schools";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_schools"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "web_classrooms" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_classrooms";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_classrooms"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "web_enrollments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_enrollments";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_enrollments"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "web_teacher_assignments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_teacher_assignments";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_teacher_assignments"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "lesson_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "lesson_runs";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "lesson_runs"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "generated_lesson_plans" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "generated_lesson_plans";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "generated_lesson_plans"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "lesson_interactions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "lesson_interactions";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "lesson_interactions"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "lesson_parent_summaries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "lesson_parent_summaries";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "lesson_parent_summaries"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
ALTER TABLE "learner_brain_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "learner_brain_profiles";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "learner_brain_profiles"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

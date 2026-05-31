-- Web-domain persistence — backs the remaining domain stores so every
-- AIVO_PERSISTENCE_*=postgres flag has a real implementation. The web
-- app's own domain objects, separate from the microservices' canonical
-- tables (hence the web_ prefix). TEXT ids (no FK), ISO-8601 TEXT
-- timestamps, full object in JSONB; columns only for query predicates.

CREATE TABLE IF NOT EXISTS "web_notifications" ("id" TEXT PRIMARY KEY, "tenant_id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "read_at" TEXT, "created_at" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_notifications_user_idx" ON "web_notifications" ("tenant_id", "user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_notification_deliveries" ("id" TEXT PRIMARY KEY, "notification_id" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_notif_deliveries_idx" ON "web_notification_deliveries" ("notification_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_audit_logs" ("seq" BIGSERIAL PRIMARY KEY, "tenant_id" TEXT, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_audit_logs_tenant_idx" ON "web_audit_logs" ("tenant_id", "seq");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_users" ("id" TEXT PRIMARY KEY, "tenant_id" TEXT, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_memberships" ("seq" BIGSERIAL PRIMARY KEY, "user_id" TEXT NOT NULL, "tenant_id" TEXT NOT NULL, "created_at" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_memberships_user_idx" ON "web_memberships" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_memberships_tenant_idx" ON "web_memberships" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_learner_profiles" ("id" TEXT PRIMARY KEY, "tenant_id" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_learner_profiles_tenant_idx" ON "web_learner_profiles" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_parent_learner_relationships" ("id" TEXT PRIMARY KEY, "seq" BIGSERIAL NOT NULL, "parent_user_id" TEXT NOT NULL, "learner_id" TEXT NOT NULL, "tenant_id" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_plr_learner_idx" ON "web_parent_learner_relationships" ("learner_id", "tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_plr_parent_idx" ON "web_parent_learner_relationships" ("parent_user_id", "tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_parent_assessments" ("id" TEXT PRIMARY KEY, "learner_id" TEXT NOT NULL, "tenant_id" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_parent_assessments_idx" ON "web_parent_assessments" ("learner_id", "tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_baseline_assessments" ("id" TEXT PRIMARY KEY, "learner_id" TEXT NOT NULL, "tenant_id" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_baseline_assessments_idx" ON "web_baseline_assessments" ("learner_id", "tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_baseline_questions" ("id" TEXT PRIMARY KEY, "baseline_id" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_baseline_questions_idx" ON "web_baseline_questions" ("baseline_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_baseline_attempts" ("id" TEXT PRIMARY KEY, "seq" BIGSERIAL NOT NULL, "baseline_id" TEXT NOT NULL, "tenant_id" TEXT NOT NULL, "question_id" TEXT NOT NULL, "learner_id" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_baseline_attempts_baseline_idx" ON "web_baseline_attempts" ("baseline_id", "tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_baseline_attempts_pair_idx" ON "web_baseline_attempts" ("question_id", "learner_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_baseline_telemetry" ("seq" BIGSERIAL PRIMARY KEY, "tenant_id" TEXT NOT NULL, "learner_id" TEXT, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_baseline_telemetry_idx" ON "web_baseline_telemetry" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_subjects" ("id" TEXT PRIMARY KEY, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_skills" ("id" TEXT PRIMARY KEY, "subject_id" TEXT, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_skills_subject_idx" ON "web_skills" ("subject_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_mastery_maps" ("id" TEXT PRIMARY KEY, "learner_id" TEXT NOT NULL, "tenant_id" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_mastery_maps_idx" ON "web_mastery_maps" ("learner_id", "tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_skill_masteries" ("id" TEXT PRIMARY KEY, "learner_id" TEXT NOT NULL, "tenant_id" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_skill_masteries_idx" ON "web_skill_masteries" ("learner_id", "tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_learning_paths" ("id" TEXT PRIMARY KEY, "learner_id" TEXT NOT NULL, "tenant_id" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_learning_paths_idx" ON "web_learning_paths" ("learner_id", "tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_consent_records" ("id" TEXT PRIMARY KEY, "parent_user_id" TEXT NOT NULL, "learner_id" TEXT, "tenant_id" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_consent_records_idx" ON "web_consent_records" ("parent_user_id", "tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_iep_documents" ("id" TEXT PRIMARY KEY, "learner_id" TEXT NOT NULL, "tenant_id" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_iep_documents_idx" ON "web_iep_documents" ("learner_id", "tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_age_gate_records" ("learner_id" TEXT PRIMARY KEY, "tenant_id" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_policy_versions" ("id" TEXT PRIMARY KEY, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_subprocessors" ("id" TEXT PRIMARY KEY, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_quest_worlds" ("id" TEXT PRIMARY KEY, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_quest_chapters" ("id" TEXT PRIMARY KEY, "world_id" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_quest_chapters_idx" ON "web_quest_chapters" ("world_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_quest_progress" ("id" TEXT PRIMARY KEY, "learner_id" TEXT NOT NULL, "tenant_id" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_quest_progress_idx" ON "web_quest_progress" ("learner_id", "tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_schools" ("id" TEXT PRIMARY KEY, "tenant_id" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_schools_tenant_idx" ON "web_schools" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_classrooms" ("id" TEXT PRIMARY KEY, "tenant_id" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_classrooms_tenant_idx" ON "web_classrooms" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_enrollments" ("id" TEXT PRIMARY KEY, "classroom_id" TEXT NOT NULL, "tenant_id" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_enrollments_classroom_idx" ON "web_enrollments" ("classroom_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_enrollments_tenant_idx" ON "web_enrollments" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_teacher_assignments" ("id" TEXT PRIMARY KEY, "teacher_id" TEXT NOT NULL, "tenant_id" TEXT NOT NULL, "data" JSONB NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_teacher_assignments_idx" ON "web_teacher_assignments" ("teacher_id", "tenant_id");

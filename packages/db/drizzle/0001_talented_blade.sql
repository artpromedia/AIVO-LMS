CREATE TYPE "public"."homework_mode" AS ENUM('STANDARD', 'SUPPORTED', 'LOW_VERBAL', 'NON_VERBAL', 'PRE_SYMBOLIC');--> statement-breakpoint
CREATE TYPE "public"."homework_status" AS ENUM('PROCESSING', 'READY', 'IN_PROGRESS', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('LESSON', 'PRACTICE', 'REVIEW', 'ASSESSMENT', 'HOMEWORK');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('STARTED', 'CONTENT_GENERATING', 'CONTENT_READY', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED');--> statement-breakpoint
CREATE TABLE "gradebook_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"subject" varchar(100) NOT NULL,
	"skill" varchar(255) NOT NULL,
	"mastery_score" real DEFAULT 0,
	"attempts_count" integer DEFAULT 0,
	"last_assessed_at" timestamp,
	"trend" varchar(20) DEFAULT 'stable',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"subject" varchar(100) NOT NULL,
	"current_topic" varchar(255),
	"topic_sequence" jsonb DEFAULT '[]'::jsonb,
	"completed_topics" jsonb DEFAULT '[]'::jsonb,
	"mastery_map" jsonb DEFAULT '{}'::jsonb,
	"curriculum_alignment" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"content_type" "content_type" DEFAULT 'LESSON',
	"subject" varchar(100) NOT NULL,
	"topic" varchar(255),
	"grade_target" varchar(20),
	"delivery_level" varchar(20),
	"generated_content" jsonb DEFAULT '{}'::jsonb,
	"quality_score" real,
	"quality_gate_log" jsonb DEFAULT '{}'::jsonb,
	"sensory_adjustments" jsonb DEFAULT '{}'::jsonb,
	"accommodations" jsonb DEFAULT '{}'::jsonb,
	"prompt_tokens" integer DEFAULT 0,
	"completion_tokens" integer DEFAULT 0,
	"model_used" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"tutor_sku" varchar(100) NOT NULL,
	"subject" varchar(100) NOT NULL,
	"status" "session_status" DEFAULT 'STARTED',
	"content_type" "content_type" DEFAULT 'LESSON',
	"functioning_level" varchar(30),
	"delivery_level" varchar(30),
	"brain_context_snapshot" jsonb DEFAULT '{}'::jsonb,
	"session_data" jsonb DEFAULT '{}'::jsonb,
	"mastery_before" jsonb DEFAULT '{}'::jsonb,
	"mastery_after" jsonb DEFAULT '{}'::jsonb,
	"xp_earned" integer DEFAULT 0,
	"duration_seconds" integer DEFAULT 0,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "token_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"service" varchar(50) NOT NULL,
	"model" varchar(100) NOT NULL,
	"prompt_tokens" integer DEFAULT 0,
	"completion_tokens" integer DEFAULT 0,
	"total_tokens" integer DEFAULT 0,
	"cost_cents" integer DEFAULT 0,
	"request_type" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"tutor_sku" varchar(100) NOT NULL,
	"tutor_name" varchar(50) NOT NULL,
	"session_type" varchar(30) DEFAULT 'standard',
	"functioning_level" varchar(30),
	"messages" jsonb DEFAULT '[]'::jsonb,
	"brain_context" jsonb DEFAULT '{}'::jsonb,
	"skills_focused" jsonb DEFAULT '[]'::jsonb,
	"mastery_updates" jsonb DEFAULT '{}'::jsonb,
	"xp_earned" integer DEFAULT 0,
	"duration_seconds" integer DEFAULT 0,
	"completion_quality" real,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "homework_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"subject" varchar(128) NOT NULL,
	"original_file_type" varchar(64),
	"extracted_text" varchar(65535),
	"extracted_problems" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"adapted_problems" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"homework_mode" "homework_mode" NOT NULL,
	"status" "homework_status" DEFAULT 'PROCESSING' NOT NULL,
	"detected_subject" varchar(64),
	"subject_confidence" numeric(3, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homework_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"homework_assignment_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"tutor_sku" varchar(100),
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completion_quality" numeric(3, 2),
	"problems_attempted" integer DEFAULT 0,
	"problems_completed" integer DEFAULT 0,
	"hints_used" integer DEFAULT 0,
	"duration_seconds" integer DEFAULT 0,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "collaboration_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"invited_by" uuid NOT NULL,
	"invitee_email" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"token" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learner_caregivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"caregiver_email" varchar(255) NOT NULL,
	"caregiver_user_id" uuid,
	"invited_by" uuid NOT NULL,
	"relationship" varchar(100),
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"permissions" jsonb DEFAULT '["read_summary","submit_observations"]'::jsonb,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learner_teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"teacher_email" varchar(255) NOT NULL,
	"teacher_user_id" uuid,
	"invited_by" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"role" varchar(50) DEFAULT 'teacher' NOT NULL,
	"permissions" jsonb DEFAULT '["read_brain","submit_insights"]'::jsonb,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learner_therapists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"therapist_email" varchar(255) NOT NULL,
	"therapist_user_id" uuid,
	"invited_by" uuid NOT NULL,
	"specialty" varchar(100),
	"credentials" varchar(255),
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"permissions" jsonb DEFAULT '["read_brain_hipaa","therapy_goals","submit_insights"]'::jsonb,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "therapy_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"therapist_id" uuid,
	"goal_text" text NOT NULL,
	"domain" varchar(100),
	"baseline" varchar(255),
	"target_criteria" varchar(255),
	"current_progress" varchar(255),
	"status" varchar(20) DEFAULT 'active',
	"aligned_iep_goal_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "therapy_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"therapist_id" uuid,
	"session_date" timestamp NOT NULL,
	"notes" text,
	"goals_addressed" jsonb DEFAULT '[]'::jsonb,
	"progress_updates" jsonb DEFAULT '{}'::jsonb,
	"duration" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "learners" ADD COLUMN "zip_code" varchar(20);--> statement-breakpoint
ALTER TABLE "learners" ADD COLUMN "country" varchar(10) DEFAULT 'US';--> statement-breakpoint
ALTER TABLE "learners" ADD COLUMN "region" varchar(100);--> statement-breakpoint
ALTER TABLE "learners" ADD COLUMN "district_id" varchar(100);--> statement-breakpoint
ALTER TABLE "learners" ADD COLUMN "district_name" varchar(255);--> statement-breakpoint
ALTER TABLE "learners" ADD COLUMN "curriculum_framework" varchar(100);--> statement-breakpoint
ALTER TABLE "learners" ADD COLUMN "curriculum_alignment" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "gradebook_entries" ADD CONSTRAINT "gradebook_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradebook_entries" ADD CONSTRAINT "gradebook_entries_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_content" ADD CONSTRAINT "lesson_content_session_id_lesson_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."lesson_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_sessions" ADD CONSTRAINT "lesson_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_sessions" ADD CONSTRAINT "lesson_sessions_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_usage" ADD CONSTRAINT "token_usage_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_sessions" ADD CONSTRAINT "tutor_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_sessions" ADD CONSTRAINT "tutor_sessions_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_assignments" ADD CONSTRAINT "homework_assignments_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_sessions" ADD CONSTRAINT "homework_sessions_homework_assignment_id_homework_assignments_id_fk" FOREIGN KEY ("homework_assignment_id") REFERENCES "public"."homework_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_sessions" ADD CONSTRAINT "homework_sessions_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_invites" ADD CONSTRAINT "collaboration_invites_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_invites" ADD CONSTRAINT "collaboration_invites_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_invites" ADD CONSTRAINT "collaboration_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_caregivers" ADD CONSTRAINT "learner_caregivers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_caregivers" ADD CONSTRAINT "learner_caregivers_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_caregivers" ADD CONSTRAINT "learner_caregivers_caregiver_user_id_users_id_fk" FOREIGN KEY ("caregiver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_caregivers" ADD CONSTRAINT "learner_caregivers_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_teachers" ADD CONSTRAINT "learner_teachers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_teachers" ADD CONSTRAINT "learner_teachers_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_teachers" ADD CONSTRAINT "learner_teachers_teacher_user_id_users_id_fk" FOREIGN KEY ("teacher_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_teachers" ADD CONSTRAINT "learner_teachers_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_therapists" ADD CONSTRAINT "learner_therapists_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_therapists" ADD CONSTRAINT "learner_therapists_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_therapists" ADD CONSTRAINT "learner_therapists_therapist_user_id_users_id_fk" FOREIGN KEY ("therapist_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_therapists" ADD CONSTRAINT "learner_therapists_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_goals" ADD CONSTRAINT "therapy_goals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_goals" ADD CONSTRAINT "therapy_goals_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_goals" ADD CONSTRAINT "therapy_goals_therapist_id_learner_therapists_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."learner_therapists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_therapist_id_learner_therapists_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."learner_therapists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "homework_assignments_learner_id_idx" ON "homework_assignments" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "homework_assignments_status_idx" ON "homework_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "homework_sessions_assignment_id_idx" ON "homework_sessions" USING btree ("homework_assignment_id");--> statement-breakpoint
CREATE INDEX "homework_sessions_learner_id_idx" ON "homework_sessions" USING btree ("learner_id");
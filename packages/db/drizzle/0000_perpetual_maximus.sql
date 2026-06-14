CREATE TYPE "public"."assessment_mode" AS ENUM('STANDARD', 'MODIFIED', 'PICTURE_BASED', 'SWITCH_SCAN', 'PARTNER_ASSISTED', 'OBSERVATIONAL');--> statement-breakpoint
CREATE TYPE "public"."assessment_status" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."functioning_level" AS ENUM('STANDARD', 'SUPPORTED', 'LOW_VERBAL', 'NON_VERBAL', 'PRE_SYMBOLIC');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('not_started', 'emerging', 'developing', 'achieved');--> statement-breakpoint
CREATE TYPE "public"."recommendation_status" AS ENUM('PENDING', 'APPROVED', 'DECLINED', 'ADJUSTED');--> statement-breakpoint
CREATE TYPE "public"."recommendation_type" AS ENUM('brain_profile_review', 'path_adjustment', 'accommodation_add', 'accommodation_remove', 'goal_suggestion', 'curriculum_shift', 'rebaseline', 'brain_upgrade', 'regression_alert', 'tutor_suggestion', 'functioning_level_change', 'iep_goal_met', 'iep_refresh');--> statement-breakpoint
CREATE TYPE "public"."snapshot_trigger" AS ENUM('initial_clone', 'parent_approved', 'mastery_threshold', 'rebaseline', 'main_brain_upgrade', 'tutor_addon_activated', 'tutor_addon_deactivated');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('ACTIVE', 'PAST_DUE', 'CANCELLED', 'TRIALING');--> statement-breakpoint
CREATE TYPE "public"."tenant_type" AS ENUM('B2C_FAMILY', 'B2B_SCHOOL', 'B2B_DISTRICT');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('PARENT', 'LEARNER', 'TEACHER', 'CAREGIVER', 'THERAPIST', 'PLATFORM_ADMIN', 'DISTRICT_ADMIN');--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "tenant_type" DEFAULT 'B2C_FAMILY' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"child_id" uuid,
	"consent_type" varchar(50) NOT NULL,
	"version" varchar(20) NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" varchar(255),
	"password_hash" text,
	"name" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"email_verified" boolean DEFAULT false,
	"avatar_url" text,
	"google_id" varchar(255),
	"apple_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iep_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_url" text,
	"parsed_data" jsonb,
	"status" varchar(20) DEFAULT 'uploaded',
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iep_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"iep_profile_id" uuid,
	"goal_text" text NOT NULL,
	"domain" varchar(100),
	"baseline" varchar(255),
	"target_criteria" varchar(255),
	"current_progress" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iep_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"disability_categories" jsonb DEFAULT '[]'::jsonb,
	"accommodations" jsonb DEFAULT '[]'::jsonb,
	"goals" jsonb DEFAULT '[]'::jsonb,
	"grade_level" varchar(20),
	"communication_system" varchar(100),
	"assistive_technology" jsonb DEFAULT '[]'::jsonb,
	"recommended_functioning_level" "functioning_level",
	"review_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learner_functioning_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"level" "functioning_level" NOT NULL,
	"determined_by" varchar(50) NOT NULL,
	"parent_signals" jsonb DEFAULT '{}'::jsonb,
	"iep_signals" jsonb DEFAULT '{}'::jsonb,
	"confidence" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"date_of_birth" timestamp,
	"grade_level" varchar(20),
	"functioning_level" "functioning_level" DEFAULT 'STANDARD',
	"communication_mode" varchar(50),
	"diagnoses" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sensory_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"visual" varchar(20) DEFAULT 'typical',
	"auditory" varchar(20) DEFAULT 'typical',
	"tactile" varchar(20) DEFAULT 'typical',
	"vestibular" varchar(20) DEFAULT 'typical',
	"proprioceptive" varchar(20) DEFAULT 'typical',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"mode" "assessment_mode" DEFAULT 'STANDARD' NOT NULL,
	"status" "assessment_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"domain_scores" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" varchar(100) NOT NULL,
	"domain" varchar(100),
	"response" jsonb NOT NULL,
	"correct" integer,
	"response_time_ms" integer,
	"confidence" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observational_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"observer_id" uuid,
	"checklist" jsonb DEFAULT '{}'::jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"communication_mode" varchar(50),
	"device_interaction" varchar(50),
	"response_method" varchar(50),
	"attention_span" varchar(50),
	"diagnoses" jsonb DEFAULT '[]'::jsonb,
	"responses" jsonb DEFAULT '{}'::jsonb,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_user_id" uuid,
	"insight_text" text NOT NULL,
	"domain" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"type" "recommendation_type" NOT NULL,
	"status" "recommendation_status" DEFAULT 'PENDING',
	"title" varchar(255) NOT NULL,
	"description" text,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"parent_notes" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_seed_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"grade_band" varchar(50) NOT NULL,
	"functioning_level" varchar(50) NOT NULL,
	"template" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_state_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brain_state_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"trigger" "snapshot_trigger" NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"mastery_levels" jsonb DEFAULT '{}'::jsonb,
	"disability_signals" jsonb DEFAULT '{}'::jsonb,
	"functioning_level_profile" jsonb DEFAULT '{}'::jsonb,
	"iep_profile" jsonb DEFAULT '{}'::jsonb,
	"sensory_profile" jsonb DEFAULT '{}'::jsonb,
	"active_accommodations" jsonb DEFAULT '[]'::jsonb,
	"curriculum_alignment" jsonb DEFAULT '{}'::jsonb,
	"active_tutors" jsonb DEFAULT '[]'::jsonb,
	"functional_curriculum" jsonb DEFAULT '{}'::jsonb,
	"episodic_memory" jsonb DEFAULT '[]'::jsonb,
	"version" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "functional_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"domain" varchar(100) NOT NULL,
	"milestone" varchar(255) NOT NULL,
	"status" "milestone_status" DEFAULT 'not_started',
	"evidence_notes" text,
	"achieved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_reported_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"description" text,
	"occurred_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"badge_type" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"rarity" varchar(20) DEFAULT 'common',
	"earned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"current_streak" integer DEFAULT 0,
	"longest_streak" integer DEFAULT 0,
	"last_activity_date" timestamp,
	"freezes_used" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"xp_amount" integer NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_subscription_id" varchar(255),
	"plan" varchar(100) NOT NULL,
	"status" "subscription_status" DEFAULT 'ACTIVE',
	"current_period_end" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"tutor_sku" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'active',
	"stripe_item_id" varchar(255),
	"activated_at" timestamp DEFAULT now() NOT NULL,
	"deactivated_at" timestamp,
	"grace_ends_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"user_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"resource_type" varchar(100),
	"resource_id" varchar(255),
	"details" jsonb DEFAULT '{}'::jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_child_id_users_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iep_documents" ADD CONSTRAINT "iep_documents_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iep_goals" ADD CONSTRAINT "iep_goals_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iep_goals" ADD CONSTRAINT "iep_goals_iep_profile_id_iep_profiles_id_fk" FOREIGN KEY ("iep_profile_id") REFERENCES "public"."iep_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iep_profiles" ADD CONSTRAINT "iep_profiles_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_functioning_levels" ADD CONSTRAINT "learner_functioning_levels_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learners" ADD CONSTRAINT "learners_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learners" ADD CONSTRAINT "learners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learners" ADD CONSTRAINT "learners_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensory_profiles" ADD CONSTRAINT "sensory_profiles_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_responses" ADD CONSTRAINT "assessment_responses_attempt_id_assessment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."assessment_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observational_assessments" ADD CONSTRAINT "observational_assessments_attempt_id_assessment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."assessment_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_assessments" ADD CONSTRAINT "parent_assessments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_assessments" ADD CONSTRAINT "parent_assessments_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_insights" ADD CONSTRAINT "brain_insights_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_recommendations" ADD CONSTRAINT "brain_recommendations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_recommendations" ADD CONSTRAINT "brain_recommendations_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_state_snapshots" ADD CONSTRAINT "brain_state_snapshots_brain_state_id_brain_states_id_fk" FOREIGN KEY ("brain_state_id") REFERENCES "public"."brain_states"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_state_snapshots" ADD CONSTRAINT "brain_state_snapshots_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_states" ADD CONSTRAINT "brain_states_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_states" ADD CONSTRAINT "brain_states_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "functional_milestones" ADD CONSTRAINT "functional_milestones_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_reported_events" ADD CONSTRAINT "parent_reported_events_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badges" ADD CONSTRAINT "badges_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badges" ADD CONSTRAINT "badges_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_subscriptions" ADD CONSTRAINT "tutor_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_subscriptions" ADD CONSTRAINT "tutor_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

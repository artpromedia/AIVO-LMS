CREATE TYPE "public"."brain_approval_status" AS ENUM('pending_parent_review', 'approved', 'amended', 'declined');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('pending', 'authorized', 'active', 'syncing', 'error', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."connector_type" AS ENUM('lms', 'sis', 'sso', 'assessment');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('pending', 'running', 'completed', 'partial', 'failed');--> statement-breakpoint
ALTER TYPE "public"."snapshot_trigger" ADD VALUE 'parent_amended' BEFORE 'mastery_threshold';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'SALES';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'MARKETING';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'CUSTOMER_CARE';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'SUPPORT';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'FINANCE';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'DEVOPS';--> statement-breakpoint
CREATE TABLE "mfa_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" varchar(6) NOT NULL,
	"purpose" varchar(20) DEFAULT 'login' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"resends" integer DEFAULT 0 NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "language_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"primary_language" varchar(50) NOT NULL,
	"secondary_languages" jsonb DEFAULT '[]'::jsonb,
	"dominance_by_domain" jsonb DEFAULT '{}'::jsonb,
	"processing_speed" jsonb DEFAULT '{}'::jsonb,
	"code_switching_frequency" real,
	"preferred_instruction_language" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transition_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"vocational_interests" jsonb DEFAULT '[]'::jsonb,
	"vocational_aptitude" jsonb DEFAULT '{}'::jsonb,
	"independent_living" jsonb DEFAULT '{}'::jsonb,
	"community_participation" jsonb DEFAULT '{}'::jsonb,
	"self_advocacy" jsonb DEFAULT '{}'::jsonb,
	"post_secondary_planning" jsonb DEFAULT '{}'::jsonb,
	"annual_goals" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"start_age" integer,
	"last_review_date" timestamp,
	"next_review_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "causal_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"domain" varchar(100) NOT NULL,
	"mastery_drop" real NOT NULL,
	"previous_mastery" real NOT NULL,
	"current_mastery" real NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"correlated_factors" jsonb DEFAULT '[]'::jsonb,
	"hypothesis" text,
	"confidence" real,
	"status" varchar(20) DEFAULT 'DETECTED' NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "avatar_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"equipped" boolean DEFAULT false,
	"purchased_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_avatar_inventory_learner_item" UNIQUE("learner_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "avatar_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"rarity" varchar(20) DEFAULT 'common',
	"coin_price" integer DEFAULT 0,
	"gem_price" integer DEFAULT 0,
	"level_required" integer DEFAULT 1,
	"grade_band_min" varchar(20),
	"grade_band_max" varchar(20),
	"image_url" varchar(500) NOT NULL,
	"is_free" boolean DEFAULT false,
	"is_default" boolean DEFAULT false,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "break_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"activity_type" varchar(50) NOT NULL,
	"duration_seconds" integer DEFAULT 0,
	"trigger" varchar(50),
	"xp_awarded" integer DEFAULT 5,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenge_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"score" integer DEFAULT 0,
	"answers_correct" integer DEFAULT 0,
	"answers_total" integer DEFAULT 0,
	"completed_at" timestamp,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"challenge_type" varchar(30) NOT NULL,
	"subject" varchar(100),
	"title" varchar(255) NOT NULL,
	"invite_code" varchar(8),
	"status" varchar(20) DEFAULT 'WAITING' NOT NULL,
	"max_participants" integer DEFAULT 2,
	"question_bank" jsonb DEFAULT '[]'::jsonb,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_by" uuid,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currency_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"currency_type" varchar(10) NOT NULL,
	"amount" integer NOT NULL,
	"reason" varchar(100) NOT NULL,
	"reference_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaderboard_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"scope" varchar(20) NOT NULL,
	"scope_id" varchar(100),
	"total_xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"rank" integer,
	"weekly_xp" integer DEFAULT 0,
	"monthly_xp" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_leaderboard_learner_scope" UNIQUE("learner_id","scope","scope_id")
);
--> statement-breakpoint
CREATE TABLE "lesson_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"teacher_user_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"subject" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"grade_level" varchar(20),
	"content" jsonb DEFAULT '{}'::jsonb,
	"accommodations" jsonb DEFAULT '[]'::jsonb,
	"activities" jsonb DEFAULT '[]'::jsonb,
	"formative_assessments" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(20) DEFAULT 'DRAFT',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quest_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"quest_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'LOCKED' NOT NULL,
	"score" integer DEFAULT 0,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_key" varchar(50) NOT NULL,
	"chapter_number" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"narrative_intro" text,
	"narrative_outro" text,
	"subject" varchar(100) NOT NULL,
	"xp_reward" integer DEFAULT 50,
	"coin_reward" integer DEFAULT 10,
	"boss_assessment" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_quests_world_chapter" UNIQUE("world_key","chapter_number")
);
--> statement-breakpoint
CREATE TABLE "sel_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"emotion" varchar(50) NOT NULL,
	"intensity" integer DEFAULT 3,
	"notes" text,
	"xp_awarded" integer DEFAULT 5,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sibling_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_a_id" uuid NOT NULL,
	"learner_b_id" uuid NOT NULL,
	"family_leaderboard" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "virtual_currency" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"coins" integer DEFAULT 0 NOT NULL,
	"gems" integer DEFAULT 0 NOT NULL,
	"total_coins_earned" integer DEFAULT 0 NOT NULL,
	"total_gems_earned" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_virtual_currency_learner" UNIQUE("learner_id")
);
--> statement-breakpoint
CREATE TABLE "caregiver_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"submitted_by" uuid NOT NULL,
	"category" varchar(100) DEFAULT 'General' NOT NULL,
	"notes" text NOT NULL,
	"mood" varchar(50),
	"date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"connector_id" varchar(64) NOT NULL,
	"connector_name" varchar(128) NOT NULL,
	"connector_type" "connector_type" NOT NULL,
	"status" "connection_status" DEFAULT 'pending' NOT NULL,
	"credentials" jsonb DEFAULT '{}'::jsonb,
	"config" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"external_org_id" varchar(255),
	"last_sync_at" timestamp,
	"connected_by" uuid,
	"connected_at" timestamp,
	"disconnected_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_roster_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_type" varchar(64) NOT NULL,
	"aivo_id" uuid,
	"aivo_type" varchar(64) NOT NULL,
	"external_data" jsonb DEFAULT '{}'::jsonb,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"sync_type" varchar(64) NOT NULL,
	"status" "sync_status" DEFAULT 'pending' NOT NULL,
	"records_synced" integer DEFAULT 0,
	"records_failed" integer DEFAULT 0,
	"records_skipped" integer DEFAULT 0,
	"details" jsonb DEFAULT '{}'::jsonb,
	"errors" jsonb DEFAULT '[]'::jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"duration_ms" integer,
	"triggered_by" uuid
);
--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" varchar(100) NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_email" varchar(255) NOT NULL,
	"actor_role" varchar(50) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" varchar(255),
	"details" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"tenant_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(50) NOT NULL,
	"model" varchar(100) NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"latency_ms" integer NOT NULL,
	"estimated_cost_usd" numeric(10, 6),
	"learner_id" uuid,
	"tutor_key" varchar(50),
	"session_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"key_prefix" varchar(10) NOT NULL,
	"name" varchar(255) NOT NULL,
	"scopes" jsonb NOT NULL,
	"tenant_id" uuid,
	"created_by" uuid,
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_moderation_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"content_type" varchar(50) NOT NULL,
	"flag_reason" varchar(100) NOT NULL,
	"flag_confidence" numeric(3, 2),
	"tutor_key" varchar(50),
	"provider" varchar(50),
	"learner_id" uuid,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"reviewer_id" uuid,
	"reviewer_action" varchar(50),
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'submitted' NOT NULL,
	"subject_id" uuid,
	"subject_email" varchar(255),
	"requester_id" uuid,
	"notes" text,
	"admin_notes" text,
	"sla_deadline" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"body_html" text NOT NULL,
	"body_text" text,
	"variables" jsonb DEFAULT '[]'::jsonb,
	"active" boolean DEFAULT true,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "lead_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"company" varchar(255),
	"role" varchar(100),
	"message" text,
	"school_size" varchar(50),
	"source" varchar(50) DEFAULT 'website',
	"status" varchar(50) DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config" jsonb NOT NULL,
	"changed_by" uuid,
	"change_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"response_status" integer,
	"response_body" text,
	"delivered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" varchar(2048) NOT NULL,
	"events" jsonb NOT NULL,
	"secret" varchar(255) NOT NULL,
	"active" boolean DEFAULT true,
	"tenant_id" uuid,
	"created_by" uuid,
	"last_delivery_at" timestamp,
	"last_delivery_status" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classroom_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"classroom_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"removed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "classrooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"grade_level" varchar(20),
	"subject" varchar(100),
	"teacher_id" uuid,
	"capacity" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "district_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_name" varchar(255),
	"resource_type" varchar(50) NOT NULL,
	"resource_id" varchar(255),
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "district_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"notification_prefs" jsonb DEFAULT '{}'::jsonb,
	"sso_config" jsonb DEFAULT '{}'::jsonb,
	"branding" jsonb DEFAULT '{}'::jsonb,
	"feature_overrides" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "district_settings_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "iep_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"review_date" date NOT NULL,
	"expiry_date" date,
	"case_manager_id" uuid,
	"disability_category" varchar(100),
	"placement" varchar(100),
	"accommodations" jsonb DEFAULT '[]'::jsonb,
	"goals" jsonb DEFAULT '[]'::jsonb,
	"services" jsonb DEFAULT '[]'::jsonb,
	"documents_url" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interventions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"tier" integer DEFAULT 2 NOT NULL,
	"description" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" varchar(50) DEFAULT 'active',
	"assigned_by" uuid,
	"progress_notes" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"city" varchar(100),
	"state" varchar(50),
	"zip" varchar(20),
	"phone" varchar(50),
	"principal_name" varchar(255),
	"principal_email" varchar(255),
	"enrollment_capacity" integer,
	"grade_levels" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(20) DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"role_at_school" varchar(50),
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"removed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "learner_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"badge_key" varchar(50) NOT NULL,
	"earned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learner_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"shared" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learner_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"accommodations" jsonb DEFAULT '{}'::jsonb,
	"learning_goals" jsonb DEFAULT '{}'::jsonb,
	"notifications" jsonb DEFAULT '{}'::jsonb,
	"tutor_preferences" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "learner_settings_learner_id_unique" UNIQUE("learner_id")
);
--> statement-breakpoint
CREATE TABLE "learner_streaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"current_streak" integer DEFAULT 0,
	"longest_streak" integer DEFAULT 0,
	"last_active_date" date,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "learner_streaks_learner_id_unique" UNIQUE("learner_id")
);
--> statement-breakpoint
CREATE TABLE "parent_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"learner_id" uuid,
	"type" varchar(50) NOT NULL,
	"title" varchar(500) NOT NULL,
	"body" text,
	"action_url" varchar(500),
	"urgency" varchar(20) DEFAULT 'normal',
	"read_at" timestamp,
	"dismissed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "tenant_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "status" varchar(20) DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "suspended_at" timestamp;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "suspension_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mfa_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mfa_method" varchar(20) DEFAULT 'email';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deactivated_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_ip" varchar(45);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "school_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_dashboard_visit" timestamp;--> statement-breakpoint
ALTER TABLE "learners" ADD COLUMN "school_id" uuid;--> statement-breakpoint
ALTER TABLE "brain_states" ADD COLUMN "visual_identity" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "brain_states" ADD COLUMN "approval_status" "brain_approval_status" DEFAULT 'pending_parent_review';--> statement-breakpoint
ALTER TABLE "brain_states" ADD COLUMN "xai_explanation" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "brain_states" ADD COLUMN "parent_notes" text;--> statement-breakpoint
ALTER TABLE "badges" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "badges" ADD COLUMN "icon_url" varchar(500);--> statement-breakpoint
ALTER TABLE "streaks" ADD COLUMN "streak_tier" varchar(20) DEFAULT 'grey';--> statement-breakpoint
ALTER TABLE "mfa_codes" ADD CONSTRAINT "mfa_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "language_profiles" ADD CONSTRAINT "language_profiles_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transition_plans" ADD CONSTRAINT "transition_plans_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transition_plans" ADD CONSTRAINT "transition_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "causal_analyses" ADD CONSTRAINT "causal_analyses_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_inventory" ADD CONSTRAINT "avatar_inventory_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_inventory" ADD CONSTRAINT "avatar_inventory_item_id_avatar_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."avatar_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "break_activities" ADD CONSTRAINT "break_activities_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_created_by_learners_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currency_transactions" ADD CONSTRAINT "currency_transactions_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_teacher_user_id_users_id_fk" FOREIGN KEY ("teacher_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_progress" ADD CONSTRAINT "quest_progress_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_progress" ADD CONSTRAINT "quest_progress_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sel_checkins" ADD CONSTRAINT "sel_checkins_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sibling_links" ADD CONSTRAINT "sibling_links_learner_a_id_learners_id_fk" FOREIGN KEY ("learner_a_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sibling_links" ADD CONSTRAINT "sibling_links_learner_b_id_learners_id_fk" FOREIGN KEY ("learner_b_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_currency" ADD CONSTRAINT "virtual_currency_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caregiver_observations" ADD CONSTRAINT "caregiver_observations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caregiver_observations" ADD CONSTRAINT "caregiver_observations_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caregiver_observations" ADD CONSTRAINT "caregiver_observations_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_roster_mappings" ADD CONSTRAINT "integration_roster_mappings_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_sync_logs" ADD CONSTRAINT "integration_sync_logs_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_moderation_queue" ADD CONSTRAINT "content_moderation_queue_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_subject_id_users_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_config" ADD CONSTRAINT "platform_config_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_enrollments" ADD CONSTRAINT "classroom_enrollments_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_enrollments" ADD CONSTRAINT "classroom_enrollments_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "district_activity_log" ADD CONSTRAINT "district_activity_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "district_activity_log" ADD CONSTRAINT "district_activity_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "district_settings" ADD CONSTRAINT "district_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iep_records" ADD CONSTRAINT "iep_records_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iep_records" ADD CONSTRAINT "iep_records_case_manager_id_users_id_fk" FOREIGN KEY ("case_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_badges" ADD CONSTRAINT "learner_badges_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_milestones" ADD CONSTRAINT "learner_milestones_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_settings" ADD CONSTRAINT "learner_settings_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_settings" ADD CONSTRAINT "learner_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_streaks" ADD CONSTRAINT "learner_streaks_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_notifications" ADD CONSTRAINT "parent_notifications_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_notifications" ADD CONSTRAINT "parent_notifications_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mfa_codes_user_id_idx" ON "mfa_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mfa_codes_expires_at_idx" ON "mfa_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_ic_tenant" ON "integration_connections" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_ic_connector" ON "integration_connections" USING btree ("connector_id");--> statement-breakpoint
CREATE INDEX "idx_ic_status" ON "integration_connections" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_irm_unique_mapping" ON "integration_roster_mappings" USING btree ("connection_id","external_id","external_type");--> statement-breakpoint
CREATE INDEX "idx_irm_connection" ON "integration_roster_mappings" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "idx_isl_connection" ON "integration_sync_logs" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "idx_isl_started" ON "integration_sync_logs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_actor" ON "admin_audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_action" ON "admin_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_log_resource" ON "admin_audit_log" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_created" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_usage_created" ON "ai_usage_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_usage_provider" ON "ai_usage_log" USING btree ("provider","created_at");--> statement-breakpoint
CREATE INDEX "idx_lead_submissions_type" ON "lead_submissions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_lead_submissions_email" ON "lead_submissions" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_lead_submissions_created" ON "lead_submissions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_classroom_enrollment_unique" ON "classroom_enrollments" USING btree ("classroom_id","learner_id");--> statement-breakpoint
CREATE INDEX "idx_classrooms_school" ON "classrooms" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "idx_district_activity_tenant" ON "district_activity_log" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_iep_learner" ON "iep_records" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "idx_iep_review" ON "iep_records" USING btree ("review_date");--> statement-breakpoint
CREATE INDEX "idx_interventions_learner" ON "interventions" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "idx_schools_tenant" ON "schools" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_staff_assignment_unique" ON "staff_assignments" USING btree ("user_id","school_id");--> statement-breakpoint
ALTER TABLE "streaks" ADD CONSTRAINT "uq_streaks_learner" UNIQUE("learner_id");
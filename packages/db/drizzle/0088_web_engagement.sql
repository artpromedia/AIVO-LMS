-- 0088_web_engagement.sql
--
-- Sprint 8 remainder: web-owned engagement / learning-session / notification-
-- prefs. Notification preferences (keyed by userId) + digest schedules;
-- homework-help + calm sessions; per-learner engagement snapshot, badges,
-- sensory profile (keyed by learnerId).
--
-- NOT RLS-protected: per-learner/per-user, app-layer scoping (consistent with
-- the other recent web_* domains). Live gradebook/leaderboard read from
-- engagement-svc/learning-svc over REST (ADR 0015). aivo_app granted via 0050.

CREATE TABLE IF NOT EXISTS "web_notification_preferences" (
  "user_id" text PRIMARY KEY NOT NULL, "tenant_id" text NOT NULL, "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_digest_schedules" (
  "id" text PRIMARY KEY NOT NULL, "tenant_id" text NOT NULL, "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_digest_schedules_tenant_idx" ON "web_digest_schedules" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_homework_help_sessions" (
  "id" text PRIMARY KEY NOT NULL, "tenant_id" text NOT NULL, "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_homework_help_sessions_tenant_idx" ON "web_homework_help_sessions" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_calm_sessions" (
  "id" text PRIMARY KEY NOT NULL, "tenant_id" text NOT NULL, "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_calm_sessions_tenant_idx" ON "web_calm_sessions" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_learner_engagement" (
  "learner_id" text PRIMARY KEY NOT NULL, "tenant_id" text NOT NULL, "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_learner_badges" (
  "id" text PRIMARY KEY NOT NULL, "tenant_id" text NOT NULL, "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_learner_badges_tenant_idx" ON "web_learner_badges" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_learner_sensory_profiles" (
  "learner_id" text PRIMARY KEY NOT NULL, "tenant_id" text NOT NULL, "data" jsonb NOT NULL
);

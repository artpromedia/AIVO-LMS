-- 0086_web_audio_safety.sql
--
-- Sprint 7 (persistence migration): durable TTS/audio/read-aloud + safety/
-- moderation. Audio cache (composite key tenant:lang:hash → asset, hit
-- counters) + pronunciation/voice prefs must persist; moderation events +
-- safety audits are append-only compliance trails.
--
-- NOT RLS-protected: tenant_id present but read by admin review/usage consoles
-- across tenants (optional-tenant list filters) — app-layer scoping, same as
-- the other admin-accessed web_* tables. Canonical responsible-AI evals/models
-- read from responsible-ai-svc over REST. aivo_app granted via 0050.

CREATE TABLE IF NOT EXISTS "web_audio_assets" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_audio_assets_idx" ON "web_audio_assets" ("tenant_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_tts_generation_jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_tts_generation_jobs_idx" ON "web_tts_generation_jobs" ("tenant_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_pronunciation_overrides" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_pronunciation_overrides_idx" ON "web_pronunciation_overrides" ("tenant_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_read_aloud_usage_events" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_read_aloud_usage_events_idx" ON "web_read_aloud_usage_events" ("tenant_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_learner_voice_preferences" (
  "learner_id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_audio_cache_entries" (
  "cache_key" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_safety_policy_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_moderation_events" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_moderation_events_idx" ON "web_moderation_events" ("tenant_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_human_review_cases" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_human_review_cases_idx" ON "web_human_review_cases" ("tenant_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_blocked_generations" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_blocked_generations_idx" ON "web_blocked_generations" ("tenant_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_tutor_response_audits" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_tutor_response_audits_idx" ON "web_tutor_response_audits" ("tenant_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_homework_input_audits" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_homework_input_audits_idx" ON "web_homework_input_audits" ("tenant_id");

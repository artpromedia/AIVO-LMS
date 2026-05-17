-- Phase C + D: IEP team collaboration, e-signatures, parent sharing,
-- and ongoing IEP communication (progress notes/reports, amendments,
-- parent notification preferences, in-app notifications, review reminders).
--
-- All statements are idempotent (IF NOT EXISTS) so this can apply cleanly
-- on a fresh DB or one that already had Phase B (0010) applied via push.

-- --- iep_profiles: extra Phase C/D columns ---------------------------------
ALTER TABLE "iep_profiles"
  ADD COLUMN IF NOT EXISTS "in_review_notified_at" timestamp,
  ADD COLUMN IF NOT EXISTS "revision_counter" integer NOT NULL DEFAULT 0;

-- --- Phase C: team collaboration & e-signatures ----------------------------
CREATE TABLE IF NOT EXISTS "iep_team_members" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "iep_profile_id" uuid NOT NULL REFERENCES "iep_profiles"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "role" varchar(30) NOT NULL,
  "added_by" uuid NOT NULL REFERENCES "users"("id"),
  "added_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "iep_team_members_profile_user_role_uidx"
  ON "iep_team_members" ("iep_profile_id", "user_id", "role");
CREATE INDEX IF NOT EXISTS "idx_iep_team_members_profile"
  ON "iep_team_members" ("iep_profile_id");

CREATE TABLE IF NOT EXISTS "iep_comments" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "iep_profile_id" uuid NOT NULL REFERENCES "iep_profiles"("id"),
  "section" varchar(30) NOT NULL,
  "goal_id" uuid,
  "author_id" uuid NOT NULL REFERENCES "users"("id"),
  "body" text NOT NULL,
  "mentions" jsonb DEFAULT '[]'::jsonb,
  "parent_comment_id" uuid,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "resolved_at" timestamp
);
CREATE INDEX IF NOT EXISTS "idx_iep_comments_profile_section"
  ON "iep_comments" ("iep_profile_id", "section");

CREATE TABLE IF NOT EXISTS "iep_revisions" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "iep_profile_id" uuid NOT NULL REFERENCES "iep_profiles"("id"),
  "section" varchar(30) NOT NULL,
  "snapshot" jsonb NOT NULL,
  "author_id" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_iep_revisions_profile_created"
  ON "iep_revisions" ("iep_profile_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "iep_signatures" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "iep_profile_id" uuid NOT NULL REFERENCES "iep_profiles"("id"),
  "signer_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "signer_role" varchar(30) NOT NULL,
  "typed_name" varchar(255) NOT NULL,
  "signed_at" timestamp NOT NULL DEFAULT now(),
  "ip_hash" varchar(64),
  "status" varchar(20) NOT NULL DEFAULT 'signed'
);
CREATE UNIQUE INDEX IF NOT EXISTS "iep_signatures_profile_user_role_uidx"
  ON "iep_signatures" ("iep_profile_id", "signer_user_id", "signer_role");

-- --- Phase D: parent sharing & ongoing IEP communication -------------------
CREATE TABLE IF NOT EXISTS "iep_progress_notes" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "iep_profile_id" uuid NOT NULL REFERENCES "iep_profiles"("id"),
  "learner_id" uuid NOT NULL REFERENCES "learners"("id"),
  "goal_id" uuid,
  "author_id" uuid NOT NULL REFERENCES "users"("id"),
  "body" text NOT NULL,
  "attachment_url" text,
  -- 'parent' | 'team' | 'internal'
  "visibility" varchar(20) NOT NULL DEFAULT 'parent',
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_iep_progress_notes_profile_created"
  ON "iep_progress_notes" ("iep_profile_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_iep_progress_notes_learner_created"
  ON "iep_progress_notes" ("learner_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "iep_progress_reports" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "iep_profile_id" uuid NOT NULL REFERENCES "iep_profiles"("id"),
  "learner_id" uuid NOT NULL REFERENCES "learners"("id"),
  "period" varchar(30) NOT NULL,
  "narrative" text,
  "ai_summary" jsonb,
  -- draft | sent
  "status" varchar(20) NOT NULL DEFAULT 'draft',
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "sent_by" uuid REFERENCES "users"("id"),
  "sent_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_iep_progress_reports_profile_period"
  ON "iep_progress_reports" ("iep_profile_id", "period");
CREATE INDEX IF NOT EXISTS "idx_iep_progress_reports_learner_created"
  ON "iep_progress_reports" ("learner_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "iep_amendments" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "iep_profile_id" uuid NOT NULL REFERENCES "iep_profiles"("id"),
  "learner_id" uuid NOT NULL REFERENCES "learners"("id"),
  "summary" text NOT NULL,
  "proposed_changes" jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- proposed | acknowledged | merged | objected
  "status" varchar(20) NOT NULL DEFAULT 'proposed',
  "proposed_by" uuid NOT NULL REFERENCES "users"("id"),
  "acknowledged_by" uuid REFERENCES "users"("id"),
  "acknowledged_at" timestamp,
  "parent_response" text,
  "revision_counter" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_iep_amendments_profile_status"
  ON "iep_amendments" ("iep_profile_id", "status");
CREATE INDEX IF NOT EXISTS "idx_iep_amendments_learner_created"
  ON "iep_amendments" ("learner_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "parent_notification_preferences" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "parent_id" uuid NOT NULL REFERENCES "users"("id"),
  -- { progress_notes:{email,inApp}, reports:{...}, amendments:{...}, reminders:{...} }
  "prefs" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "parent_notification_preferences_parent_uidx"
  ON "parent_notification_preferences" ("parent_id");

CREATE TABLE IF NOT EXISTS "parent_in_app_notifications" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "parent_id" uuid NOT NULL REFERENCES "users"("id"),
  "learner_id" uuid REFERENCES "learners"("id"),
  -- progress_notes | reports | amendments | reminders
  "category" varchar(30) NOT NULL,
  "template" varchar(60) NOT NULL,
  "title" varchar(255) NOT NULL,
  "body" text,
  "link" varchar(1024),
  "read_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_parent_in_app_notifications_parent_created"
  ON "parent_in_app_notifications" ("parent_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_parent_in_app_notifications_parent_unread"
  ON "parent_in_app_notifications" ("parent_id", "read_at");

CREATE TABLE IF NOT EXISTS "iep_review_reminders" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "iep_profile_id" uuid NOT NULL REFERENCES "iep_profiles"("id"),
  -- Days-out threshold: 90, 60, 30.
  "threshold" integer NOT NULL,
  "review_date" timestamp NOT NULL,
  "sent_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "iep_review_reminders_profile_threshold_uidx"
  ON "iep_review_reminders" ("iep_profile_id", "threshold");

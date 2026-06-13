-- 0111_invite_reminder_latches.sql
--
-- Sprint C-08 — invite reminder latches.
--
-- Two scheduled comms-svc jobs need exactly-once / rate-capped state:
--   * contribution-nudge: per-member latch (`contribution_nudge_last_sent_at`)
--     enforces the 7-day cap, and `contribution_nudge_opt_out` lets a teammate
--     turn the reminders off. Added to all three per-role invite tables.
--   * expiry-warning: `expiry_warning_sent_at` on teacher_parent_invites warns
--     a still-pending token invite exactly once before it lapses.
--
-- ADD COLUMN inherits each table's existing grants/RLS, so no policy changes.

ALTER TABLE "learner_teachers"
  ADD COLUMN IF NOT EXISTS "contribution_nudge_last_sent_at" timestamp;
--> statement-breakpoint
ALTER TABLE "learner_teachers"
  ADD COLUMN IF NOT EXISTS "contribution_nudge_opt_out" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "learner_caregivers"
  ADD COLUMN IF NOT EXISTS "contribution_nudge_last_sent_at" timestamp;
--> statement-breakpoint
ALTER TABLE "learner_caregivers"
  ADD COLUMN IF NOT EXISTS "contribution_nudge_opt_out" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "learner_therapists"
  ADD COLUMN IF NOT EXISTS "contribution_nudge_last_sent_at" timestamp;
--> statement-breakpoint
ALTER TABLE "learner_therapists"
  ADD COLUMN IF NOT EXISTS "contribution_nudge_opt_out" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "teacher_parent_invites"
  ADD COLUMN IF NOT EXISTS "expiry_warning_sent_at" timestamp;

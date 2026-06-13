-- Sprint C-13 — brain evolution: capture what changed.
--
-- Create brain_profile_changes: the dedicated, append-only record of every
-- change to a learner's brain profile — structural (functioning level,
-- accommodations added/removed, tutor activation, IEP-derived shifts) OR
-- mastery — that powers the parent's "what changed since you approved"
-- timeline. Structural rows carry requires_ack = true and notify the parent;
-- mastery rows carry requires_ack = false and flow freely. `acked_at` is the
-- single mutable field, set when the parent acknowledges a structural delta.
--
-- Conventions match brain_profile_approvals (0108), its direct sibling: TEXT
-- ids (no FK), ISO-8601 TEXT timestamps, JSONB for the variable-shape `fields`
-- array, anchored to the same learner_brain_profiles.revision the approval
-- record keys off.
--
-- RLS: NOT applied — sibling of brain_profile_approvals (0108) and
-- web_child_profile_disclosures (0114); tenant scoping is in app code via the
-- indexed tenant_id column (same exclusion 0050 makes for web_users /
-- web_audit_logs).

CREATE TABLE IF NOT EXISTS "brain_profile_changes" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "learner_id" TEXT NOT NULL,
  "brain_profile_id" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "fields" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "summary" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "requires_ack" BOOLEAN NOT NULL DEFAULT FALSE,
  "acked_at" TEXT,
  "reminder_sent_at" TEXT,
  "created_at" TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brain_profile_changes_learner_idx" ON "brain_profile_changes" ("learner_id", "tenant_id");

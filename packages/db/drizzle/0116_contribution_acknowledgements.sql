-- Sprint C-16 — the contributor feedback loop: "your input shaped Maya's plan".
--
-- Create contribution_acknowledgements: the dedicated, append-only record
-- written when a parent APPROVES a brain profile (the honest "your input is now
-- in use" trigger — folding alone isn't; approval is). One row per contributor
-- whose OWN input was folded, naming the contributor's own folded supports/
-- tutors + the learner's first name. Powers (1) idempotency, (2) the "Your
-- contributions" summary card's acknowledged date, (3) the repeat-contribution
-- retention metric.
--
-- PRIVACY: folded_items carries ONLY this contributor's own role+domain-derived
-- decisions (their reasoning snippet + a support display label) — never another
-- contributor's content, never the child's levels/diagnoses.
--
-- Conventions match brain_profile_changes (0115) and brain_profile_approvals
-- (0108), its siblings: TEXT ids (no FK), ISO-8601 TEXT timestamps, JSONB for
-- the variable-shape folded_items array.
--
-- RLS: NOT applied — sibling of brain_profile_approvals (0108) /
-- brain_profile_changes (0115); tenant scoping is in app code via the indexed
-- tenant_id column (same exclusion 0050 makes for web_users / web_audit_logs).

CREATE TABLE IF NOT EXISTS "contribution_acknowledgements" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "learner_id" TEXT NOT NULL,
  "brain_profile_id" TEXT NOT NULL,
  "profile_revision" INTEGER NOT NULL,
  "role" TEXT NOT NULL,
  "contributor_user_id" TEXT,
  "contributor_email" TEXT NOT NULL,
  "learner_first_name" TEXT NOT NULL,
  "folded_items" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "acknowledged_at" TEXT NOT NULL,
  "notified_in_app" BOOLEAN NOT NULL DEFAULT FALSE,
  "notified_email" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contribution_acknowledgements_learner_idx" ON "contribution_acknowledgements" ("learner_id", "tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contribution_acknowledgements_contributor_idx" ON "contribution_acknowledgements" ("contributor_email", "tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contribution_acknowledgements_idem_key" ON "contribution_acknowledgements" ("learner_id", "profile_revision", "role", "contributor_email");

-- Speech Buddy parent-consent store (family-svc). Replaces the
-- SPEECH_BUDDY_DEV_CONSENTS env allow-list with a real per-(tenant, learner)
-- consent record carrying the granted age band. tutor-svc verifies against
-- this on every Speech Buddy session start; the parent grant/revoke UI writes
-- it. An active grant is a row with revoked_at IS NULL.

CREATE TABLE IF NOT EXISTS "speech_buddy_consents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL,
  "learner_id" uuid NOT NULL,
  "parent_user_id" uuid NOT NULL,
  "age_band" varchar(8) NOT NULL,
  "scope" varchar(32) NOT NULL DEFAULT 'speech_buddy',
  "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "speech_buddy_consents_tenant_learner_idx" ON "speech_buddy_consents" ("tenant_id", "learner_id");
CREATE INDEX IF NOT EXISTS "speech_buddy_consents_learner_idx" ON "speech_buddy_consents" ("learner_id");

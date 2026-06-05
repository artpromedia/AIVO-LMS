-- 0064_learner_accessibility_prefs.sql
--
-- Per-learner accessibility preferences — cross-device sync (mobile + web).
--
-- Backs:
--   - GET/POST /api/assessments/accessibility-preferences  (assessment-svc;
--     the mobile PreferencesProvider syncs through these, mirroring the
--     sensory-profile pattern)
--
-- `prefs` holds the canonical @aivo/accessibility-contract AccessibilityProfile
-- (16 fields) as JSONB, so the field set can grow in the contract without a
-- schema change. One row per learner.
--
-- See packages/db/src/schema/learners.ts (learnerAccessibilityPrefs) for the
-- drizzle definition.

CREATE TABLE IF NOT EXISTS "learner_accessibility_prefs" (
  "learner_id" uuid PRIMARY KEY NOT NULL REFERENCES "learners"("id") ON DELETE CASCADE,
  "prefs" jsonb NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

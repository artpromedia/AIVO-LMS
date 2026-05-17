-- Bring tutor_sessions table in line with Drizzle schema in
-- packages/db/src/schema/learning.ts. The legacy production table had a
-- different shape (persona_id, subject, topic, status, locale) that the
-- current Fastify route does not write to and would 500 on every insert
-- because the Drizzle insert references columns that did not exist.
--
-- The table is empty in production at the time of this migration, so we
-- can safely add the new columns and relax the NOT NULL constraints on
-- the legacy columns that the current code does not populate.

ALTER TABLE tutor_sessions
  ADD COLUMN IF NOT EXISTS tutor_sku varchar(100),
  ADD COLUMN IF NOT EXISTS tutor_name varchar(50),
  ADD COLUMN IF NOT EXISTS session_type varchar(30) DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS functioning_level varchar(30),
  ADD COLUMN IF NOT EXISTS messages jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS brain_context jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS skills_focused jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mastery_updates jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS xp_earned integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_seconds integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_quality real,
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

ALTER TABLE tutor_sessions
  ALTER COLUMN persona_id DROP NOT NULL,
  ALTER COLUMN subject DROP NOT NULL;

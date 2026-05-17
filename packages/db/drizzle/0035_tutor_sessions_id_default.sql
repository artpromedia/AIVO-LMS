-- The original tutor_sessions table was created without a default on
-- `id`, so the Fastify route's `db.insert(tutorSessions).values({...})`
-- (which never supplies an id because the Drizzle schema declares
-- `.defaultRandom()`) failed with a NOT NULL constraint violation and
-- bubbled up as a 500 on POST /api/tutor/session/start.
--
-- gen_random_uuid() is built into PostgreSQL 13+, no extension needed.
ALTER TABLE tutor_sessions
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

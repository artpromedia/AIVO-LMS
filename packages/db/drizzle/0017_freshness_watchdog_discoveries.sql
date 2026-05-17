-- Sprint 9 (Task #100 / #189): freshness watchdog discovery store.
-- Persists the set of job names the watchdog has observed at runtime,
-- with a `first_seen_at` that never changes after insert and a
-- `last_seen_at` that is bumped on every observation. Idempotent.

CREATE TABLE IF NOT EXISTS "freshness_watchdog_discoveries" (
  "job_name" varchar(100) PRIMARY KEY,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);

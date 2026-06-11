-- Wave D (G6) — summer bridge opt-in.
-- A parent opts a learner into next-grade summer preparation: during a
-- calendar break of kind 'summer', /pacing/current serves a summerBridge
-- payload (review of the closing grade's recent units + the NEXT grade
-- band's opening catalogue units fetched from curriculum-svc — never
-- LLM-invented, per ADR-0040/0041) instead of plain holiday prep.
-- Default false: holiday behaviour is unchanged until a parent opts in.
ALTER TABLE learner_pacing_plans
  ADD COLUMN IF NOT EXISTS opt_in_summer_bridge BOOLEAN NOT NULL DEFAULT FALSE;

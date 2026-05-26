-- Sprint 15D: learner accessibility preferences.
--
-- We persist the toggle bag from AccessibilityPanel under
-- `learner_preferences.accessibility`. The table is created here if it
-- doesn't already exist so this migration is idempotent across environments
-- that may or may not have already shipped a learner_preferences table.

create table if not exists learner_preferences (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  -- Toggle bag persisted as JSON. Shape mirrors
  -- packages/learner-ui/src/inclusive-mode/useAccessibilityPreferences.ts.
  accessibility jsonb not null default '{}'::jsonb,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  unique (learner_id)
);

-- Idempotent column add for environments that already have the table from
-- an earlier private branch.
alter table learner_preferences
  add column if not exists accessibility jsonb not null default '{}'::jsonb;

create index if not exists learner_preferences_learner_id_idx
  on learner_preferences(learner_id);

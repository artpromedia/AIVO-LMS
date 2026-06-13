\pset tuples_only on
\pset format unaligned
SELECT 'learners_total=' || count(*) FROM learners;
SELECT 'lesson_runs_total=' || count(*) FROM lesson_runs;
SELECT 'lessons_completed=' || count(*) FROM lesson_runs WHERE status = 'completed';
SELECT 'pilot_learners_created_span=' || min(created_at)::date || ' .. ' || max(created_at)::date
  FROM learners WHERE district_name LIKE '%School District%' OR district_name LIKE '%Rewire%' OR district_name LIKE '%Catholic%';
SELECT 'pilot_sub_start_span=' || min(current_period_start)::date || ' .. ' || max(current_period_start)::date
  FROM subscriptions WHERE metadata ->> 'provisionedBy' = 'pilot';
SELECT 'active_pilots=' || count(DISTINCT tenant_id) FROM subscriptions
  WHERE status = 'ACTIVE' AND (metadata ->> 'provisionedBy' = 'pilot' OR plan IN ('enterprise','district'));
SELECT 'users_total=' || count(*) FROM users;

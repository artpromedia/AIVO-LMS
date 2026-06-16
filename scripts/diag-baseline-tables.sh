#!/usr/bin/env bash
set -euo pipefail
PGURL="$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)"
POD="pgq-$RANDOM"
kubectl -n aivo run "$POD" --rm -i --restart=Never --image=postgres:16-alpine \
  --env="PGURL=$PGURL" --quiet \
  --command -- psql "$PGURL" -P pager=off <<'SQL'
\echo === learners columns
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name='learners' ORDER BY ordinal_position;
\echo === baseline_profiles columns
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name='baseline_profiles' ORDER BY ordinal_position;
\echo === baseline_attempts columns
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name='baseline_attempts' ORDER BY ordinal_position;
\echo === parent_assessments columns
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name='parent_assessments' ORDER BY ordinal_position;
\echo === learner_functioning_profiles columns
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name='learner_functioning_profiles' ORDER BY ordinal_position;
SQL

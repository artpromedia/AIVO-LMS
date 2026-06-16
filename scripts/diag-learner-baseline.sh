#!/usr/bin/env bash
set -euo pipefail
LEARNER="${1:?learner_id required}"
PGURL="$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)"
POD="pgq-$RANDOM"
kubectl -n aivo run "$POD" --rm -i --restart=Never --image=postgres:16-alpine \
  --env="PGURL=$PGURL" --env="LID=$LEARNER" --quiet \
  --command -- sh -c 'psql "$PGURL" -P pager=off <<SQL
\echo --- learner
SELECT id, tenant_id, display_name, grade_band, readiness_state, created_at
  FROM learners WHERE id = '"'"'$LID'"'"';
\echo --- brain_profile (most recent)
SELECT id, learner_id, status, created_at, updated_at
  FROM learner_functioning_profiles
  WHERE learner_id = '"'"'$LID'"'"'
  ORDER BY updated_at DESC LIMIT 3;
\echo --- baseline_profiles for this child
SELECT id, child_id, status, created_at, updated_at
  FROM baseline_profiles
  WHERE child_id = '"'"'$LID'"'"'
  ORDER BY updated_at DESC LIMIT 5;
\echo --- baseline_attempts
SELECT id, child_id, status, created_at, updated_at
  FROM baseline_attempts
  WHERE child_id = '"'"'$LID'"'"'
  ORDER BY updated_at DESC LIMIT 5;
\echo --- parent_assessments
SELECT id, child_id, status, submitted_at, created_at
  FROM parent_assessments
  WHERE child_id = '"'"'$LID'"'"'
  ORDER BY created_at DESC LIMIT 3;
SQL'

#!/usr/bin/env bash
# Read-only diagnosis of iep_goals.current_progress type drift in prod.
set -euo pipefail
PGURL=$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)
kubectl run diag-iepgoals-$RANDOM --rm -i --restart=Never --image=postgres:16-alpine \
  --env="PGURL=$PGURL" -- sh -c 'psql "$PGURL" -v ON_ERROR_STOP=1 <<SQL
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = '"'"'iep_goals'"'"' ORDER BY ordinal_position;
SELECT count(*) AS total_rows,
       count(*) FILTER (WHERE current_progress IS NULL) AS null_rows,
       count(*) FILTER (WHERE current_progress IS NOT NULL
                        AND current_progress !~ '"'"'^\s*-?[0-9]+(\.[0-9]+)?\s*$'"'"') AS non_numeric_rows
FROM iep_goals;
SELECT DISTINCT current_progress FROM iep_goals
WHERE current_progress IS NOT NULL
  AND current_progress !~ '"'"'^\s*-?[0-9]+(\.[0-9]+)?\s*$'"'"'
LIMIT 10;
SQL'

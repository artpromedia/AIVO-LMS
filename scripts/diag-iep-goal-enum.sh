#!/usr/bin/env bash
# Read-only: list iep_goal_status enum values + status counts in iep_goals.
set -euo pipefail
PGURL=$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)
kubectl run diag-iepenum-$RANDOM --rm -i --restart=Never --image=postgres:16-alpine \
  --env="PGURL=$PGURL" -- sh -c 'psql "$PGURL" -v ON_ERROR_STOP=1 <<SQL
SELECT e.enumlabel FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = '"'"'iep_goal_status'"'"'
ORDER BY e.enumsortorder;
SQL'

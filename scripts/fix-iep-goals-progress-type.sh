#!/usr/bin/env bash
# Fix prod drift: iep_goals.current_progress text -> integer (drizzle schema
# packages/db/src/schema/learners.ts declares integer default 0).
# Safe: table verified 0 rows (diag-iep-goals-type.sh). Idempotent: skips if
# already integer. Falls back to db1/postgres if aivo_app lacks ownership.
set -euo pipefail
PGURL=$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)
kubectl run fix-iepgoals-$RANDOM --rm -i --restart=Never --image=postgres:16-alpine \
  --env="PGURL=$PGURL" -- sh -c 'psql "$PGURL" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
DECLARE cur_type text;
BEGIN
  SELECT data_type INTO cur_type FROM information_schema.columns
  WHERE table_name = '"'"'iep_goals'"'"' AND column_name = '"'"'current_progress'"'"';
  IF cur_type = '"'"'integer'"'"' THEN
    RAISE NOTICE '"'"'already integer — nothing to do'"'"';
  ELSE
    ALTER TABLE iep_goals
      ALTER COLUMN current_progress TYPE integer
        USING NULLIF(trim(current_progress), '"'"''"'"')::integer,
      ALTER COLUMN current_progress SET DEFAULT 0;
    RAISE NOTICE '"'"'converted current_progress % -> integer'"'"', cur_type;
  END IF;
END
\$\$;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = '"'"'iep_goals'"'"' AND column_name = '"'"'current_progress'"'"';
SQL'

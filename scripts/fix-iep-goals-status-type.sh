#!/usr/bin/env bash
# Fix prod drift #2: iep_goals.status enum iep_goal_status -> varchar(20)
# default 'active' (drizzle schema packages/db/src/schema/learners.ts).
# Safe: table verified 0 rows. Old enum labels remain valid varchar values.
# Idempotent: skips when already character varying. Does NOT drop the enum type
# (other tables may reference it).
set -euo pipefail
PGURL=$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)
kubectl run fix-iepstatus-$RANDOM --rm -i --restart=Never --image=postgres:16-alpine \
  --env="PGURL=$PGURL" -- sh -c 'psql "$PGURL" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
DECLARE cur_type text;
BEGIN
  SELECT data_type INTO cur_type FROM information_schema.columns
  WHERE table_name = '"'"'iep_goals'"'"' AND column_name = '"'"'status'"'"';
  IF cur_type = '"'"'character varying'"'"' THEN
    RAISE NOTICE '"'"'already varchar — nothing to do'"'"';
  ELSE
    ALTER TABLE iep_goals ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE iep_goals
      ALTER COLUMN status TYPE varchar(20) USING status::text,
      ALTER COLUMN status SET DEFAULT '"'"'active'"'"';
    RAISE NOTICE '"'"'converted status % -> varchar(20) default active'"'"', cur_type;
  END IF;
END
\$\$;
SELECT column_name, data_type, column_default FROM information_schema.columns
WHERE table_name = '"'"'iep_goals'"'"' AND column_name IN ('"'"'status'"'"','"'"'current_progress'"'"');
SQL'

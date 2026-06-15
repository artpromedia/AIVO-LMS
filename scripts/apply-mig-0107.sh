#!/usr/bin/env bash
# Apply migration 0107 (users.timezone + tz_source) — run ON aivo-app1.
set -euo pipefail
PGURL=$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)
kubectl -n aivo run mig0107-$RANDOM --rm -i --restart=Never --image=postgres:16-alpine \
  --env="PGURL=$PGURL" -- sh -c 'psql "$PGURL" -v ON_ERROR_STOP=1 -c "
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone varchar(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tz_source varchar(8);
" -c "SELECT count(*) AS tz_cols FROM information_schema.columns WHERE table_name='"'"'users'"'"' AND column_name IN ('"'"'timezone'"'"','"'"'tz_source'"'"');"'

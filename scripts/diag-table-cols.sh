#!/usr/bin/env bash
set -euo pipefail
TABLE="${1:?table required}"
PGURL="$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)"
POD="pgq-$RANDOM"
kubectl -n aivo run "$POD" --rm -i --restart=Never --image=postgres:16-alpine \
  --env="PGURL=$PGURL" --env="T=$TABLE" --quiet \
  --command -- psql "$PGURL" -P pager=off -c "
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = '$TABLE'
    ORDER BY ordinal_position;
  "

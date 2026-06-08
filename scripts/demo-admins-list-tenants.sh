#!/usr/bin/env bash
# Lists tenants so a human can pick which one the demo DISTRICT_ADMIN
# should belong to. Reads PGURL from the in-cluster db-secrets secret
# and runs a one-shot psql pod (no host postgres client required).
set -euo pipefail

PGURL="$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)"
if [[ -z "$PGURL" ]]; then
  echo "ERROR: db-secrets/database-url empty" >&2
  exit 1
fi

POD="pgquery-tenants-$RANDOM"
kubectl -n aivo run "$POD" \
  --rm -i --restart=Never \
  --image=postgres:16-alpine \
  --env="PGURL=$PGURL" \
  --command -- psql "$PGURL" -P pager=off -c "
    SELECT id, name, slug, type, created_at::date AS created
    FROM tenants
    ORDER BY created_at ASC
    LIMIT 50;
  "

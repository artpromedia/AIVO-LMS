#!/bin/bash
set -euo pipefail
PGURL=$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)
TS=$(date +%s)
kubectl -n aivo run psql-check-$TS --rm -i --restart=Never --image=postgres:15-alpine --env=PGURL="$PGURL" --command -- \
  psql "$PGURL" -At -c "
SELECT 'oidc_grants', to_regclass('public.oidc_grants');
SELECT 'device_tokens', to_regclass('public.device_tokens');
SELECT 'profile_recommendations_v2', to_regclass('public.profile_recommendations_v2');
SELECT 'web_domain_rls(0050) any web_*', count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'web_%';
"

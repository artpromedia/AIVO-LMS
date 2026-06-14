#!/usr/bin/env bash
# Inspect prod state for the learner-PIN migration sequencing (0117/0118).
# Run ON aivo-app1 (reaches db1 via the in-cluster psql pattern).
set -euo pipefail
PGURL=$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)
kubectl -n aivo run pin-mig-inspect-$RANDOM --rm -i --restart=Never --image=postgres:16-alpine \
  --env="PGURL=$PGURL" -- sh -c 'psql "$PGURL" -At -c "
SELECT '"'"'users_pin_col='"'"' || count(*) FROM information_schema.columns WHERE table_name='"'"'users'"'"' AND column_name='"'"'pin'"'"';
SELECT '"'"'learner_pin_credentials='"'"' || CASE WHEN to_regclass('"'"'public.learner_pin_credentials'"'"') IS NULL THEN '"'"'MISSING'"'"' ELSE '"'"'ok'"'"' END;
SELECT '"'"'learners_with_pin='"'"' || count(*) FROM users WHERE role='"'"'LEARNER'"'"' AND pin IS NOT NULL;
"'

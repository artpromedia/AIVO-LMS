#!/usr/bin/env bash
set -euo pipefail
LID="${1:?learner_id required}"
TID="${2:-a034635b-23a4-46b4-89e4-0eef54c3f740}"
PGURL="$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)"
POD="pgq-$RANDOM"
kubectl -n aivo run "$POD" --rm -i --restart=Never --image=postgres:16-alpine \
  --env="PGURL=$PGURL" --env="LID=$LID" --env="TID=$TID" --quiet \
  --command -- sh -c 'psql "$PGURL" -P pager=off <<SQL
\\echo === learner_brain_profiles for learner
SELECT id, learner_id, tenant_id, approval_status, clone_stage, approved_by_parent,
       cloned_at, generated_at, updated_at
  FROM learner_brain_profiles
  WHERE learner_id = '"'"'$LID'"'"' AND tenant_id = '"'"'$TID'"'"';
\\echo === count by learner only
SELECT learner_id, count(*) FROM learner_brain_profiles WHERE learner_id = '"'"'$LID'"'"' GROUP BY learner_id;
SQL'

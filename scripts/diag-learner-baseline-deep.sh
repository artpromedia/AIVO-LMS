#!/usr/bin/env bash
set -euo pipefail
LID="${1:?learner_id required}"
PGURL="$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)"
POD="pgq-$RANDOM"
kubectl -n aivo run "$POD" --rm -i --restart=Never --image=postgres:16-alpine \
  --env="PGURL=$PGURL" --env="LID=$LID" --quiet \
  --command -- sh -c "psql \"\$PGURL\" -P pager=off <<SQL
\\echo === brain profile via web-domain (if exists)
SELECT to_regclass('public.web_learner_brain_profiles') AS web_table,
       to_regclass('public.learner_brain_profiles') AS svc_table;
\\echo === learner_brain_profiles
SELECT id, learner_id, tenant_id,
       data->>'cloneStage' AS clone_stage,
       data->>'approvalStatus' AS approval,
       data->>'updatedAt' AS updated_at
  FROM learner_brain_profiles
  WHERE learner_id = '\$LID' ORDER BY id DESC LIMIT 5;
\\echo === parent assessment FULL
SELECT data FROM web_parent_assessments WHERE learner_id='\$LID';
\\echo === active baseline json
SELECT data FROM web_baseline_assessments WHERE learner_id='\$LID' ORDER BY id DESC LIMIT 1;
SQL"

#!/usr/bin/env bash
set -euo pipefail
LID="${1:?learner_id required}"
PGURL="$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)"
POD="pgq-$RANDOM"
kubectl -n aivo run "$POD" --rm -i --restart=Never --image=postgres:16-alpine \
  --env="PGURL=$PGURL" --env="LID=$LID" --quiet \
  --command -- sh -c "psql \"\$PGURL\" -P pager=off <<SQL
\\echo === learner profile
SELECT id, tenant_id, data->>'tenantId' AS data_tenant, data->>'displayName' AS name, data->>'readinessState' AS readiness
  FROM web_learner_profiles WHERE id = '\$LID';
\\echo === parent assessment
SELECT id, learner_id, tenant_id,
       data->>'status' AS status,
       data->>'submittedAt' AS submitted_at,
       data->>'createdAt' AS created_at
  FROM web_parent_assessments WHERE learner_id = '\$LID' ORDER BY id DESC LIMIT 5;
\\echo === baseline assessments
SELECT id, learner_id, tenant_id,
       data->>'status' AS status,
       data->>'startedAt' AS started_at,
       data->>'completedAt' AS completed_at,
       data->>'createdAt' AS created_at
  FROM web_baseline_assessments WHERE learner_id = '\$LID' ORDER BY id DESC LIMIT 10;
\\echo === baseline questions count per baseline
SELECT bq.baseline_id, count(*) AS n
  FROM web_baseline_questions bq
  WHERE bq.baseline_id IN (SELECT id FROM web_baseline_assessments WHERE learner_id='\$LID')
  GROUP BY bq.baseline_id;
\\echo === brain profile presence
SELECT count(*) FROM web_learner_brain_profiles WHERE learner_id='\$LID';
SQL"

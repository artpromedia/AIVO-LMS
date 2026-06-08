#!/usr/bin/env bash
# Flip a not_started baseline to in_progress so the older deployed
# web image (missing commit a496abdc) redirects parents into the runner.
# This is the exact state transition that startBaseline() applies on
# the runner's first answer-submit, so it is safe and reversible.
set -euo pipefail
BID="${1:?baseline_id required, e.g. bas_mq4ebmipcgl0ezxb}"
PGURL="$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)"
POD="pgq-$RANDOM"
kubectl -n aivo run "$POD" --rm -i --restart=Never --image=postgres:16-alpine \
  --env="PGURL=$PGURL" --env="BID=$BID" --quiet \
  --command -- sh -c 'psql "$PGURL" -P pager=off <<SQL
\\echo === before
SELECT id, data->>'"'"'status'"'"' AS status,
       data->>'"'"'startedAt'"'"' AS started_at
  FROM web_baseline_assessments WHERE id='"'"'$BID'"'"';

UPDATE web_baseline_assessments
   SET data = jsonb_set(
                jsonb_set(data, '"'"'{status}'"'"', '"'"'"in_progress"'"'"'::jsonb, true),
                '"'"'{startedAt}'"'"',
                to_jsonb(COALESCE(data->>'"'"'startedAt'"'"', to_char(now() AT TIME ZONE '"'"'UTC'"'"', '"'"'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'"'"'))),
                true)
 WHERE id = '"'"'$BID'"'"'
   AND data->>'"'"'status'"'"' = '"'"'not_started'"'"';

\\echo === after
SELECT id, data->>'"'"'status'"'"' AS status,
       data->>'"'"'startedAt'"'"' AS started_at
  FROM web_baseline_assessments WHERE id='"'"'$BID'"'"';
SQL'

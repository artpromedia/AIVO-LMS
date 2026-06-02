#!/usr/bin/env bash
set -euo pipefail
PGURL=$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)
kubectl -n aivo run pgcheck2-$$ --rm -i --restart=Never \
  --image=postgres:16-alpine \
  --env=PGURL="$PGURL" \
  --command -- sh -c '
    psql "$PGURL" -tAc "
      select t, to_regclass(t)::text
      from unnest(array[
        '"'"'baseline_item_response_logs'"'"',
        '"'"'learner_pacing_plans'"'"',
        '"'"'school_calendars'"'"',
        '"'"'lesson_runs'"'"',
        '"'"'learner_brain_profiles'"'"',
        '"'"'web_notifications'"'"',
        '"'"'web_users'"'"',
        '"'"'web_quest_worlds'"'"',
        '"'"'web_schools'"'"'
      ]) as t
    "
  '

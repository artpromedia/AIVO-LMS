#!/usr/bin/env bash
set -euo pipefail
HOSTS="${1:-app.aivolearning.com admin.aivolearning.com district.aivolearning.com}"
filter=$(printf '"%s",' $HOSTS)
filter="[${filter%,}]"
kubectl -n aivo get ingress aivo-web-ingress -o json \
  | jq -r --argjson hosts "$filter" '
      .spec.rules[]
      | select(.host as $h | $hosts | index($h))
      | .host as $h
      | .http.paths[]
      | "\($h)\t\(.path)\t-> \(.backend.service.name):\(.backend.service.port.number)"
    ' \
  | sort

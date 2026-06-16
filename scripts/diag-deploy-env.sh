#!/usr/bin/env bash
set -euo pipefail
DEPLOY="${1:-web}"
kubectl -n aivo get deploy "$DEPLOY" -o json \
  | jq -r '.spec.template.spec.containers[0].env[]? | "\(.name)=\(.value // (.valueFrom | tojson))"' \
  | sort

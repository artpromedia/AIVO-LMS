#!/usr/bin/env bash
# Rollout enterprise-readiness-audit deploy across 3 affected services.
# Usage: bash rollout-enterprise-readiness.sh TAG
set -euo pipefail
TAG="${1:?tag required}"

ALL_SVCS=(admin-svc assessment-svc comms-svc)

for svc in "${ALL_SVCS[@]}"; do
  echo "=== distribute: $svc ==="
  bash /opt/aivo-deploy/distribute-one.sh "$TAG" "$svc"
done

for svc in "${ALL_SVCS[@]}"; do
  if kubectl -n aivo get deployment "$svc" >/dev/null 2>&1; then
    kubectl -n aivo patch deployment "$svc" --type='json' \
      -p='[{"op":"replace","path":"/spec/template/spec/containers/0/imagePullPolicy","value":"IfNotPresent"}]' \
      2>/dev/null || true
    echo "=== set image: $svc -> $TAG ==="
    kubectl -n aivo set image "deployment/$svc" "$svc=ghcr.io/artpromedia/$svc:$TAG"
    kubectl -n aivo rollout status "deployment/$svc" --timeout=240s
  else
    echo "=== SKIP rollout ($svc): no deployment found ==="
  fi
done

echo "=== rollout DONE ==="
kubectl -n aivo get deployment admin-svc assessment-svc comms-svc

#!/usr/bin/env bash
# Rollout elegant-maxwell deploy: 8 services + web.
# Usage: bash rollout-elegant-maxwell.sh TAG
set -euo pipefail
TAG="${1:?tag required}"

SVCS=(admin-svc audit-svc billing-svc data-governance-svc identity-svc integration-svc learning-svc tenant-svc)
WEB_REPO=web

for svc in "${SVCS[@]}"; do
  echo "=== distribute: $svc ==="
  bash /opt/aivo-deploy/distribute-one.sh "$TAG" "$svc"
done
echo "=== distribute: $WEB_REPO ==="
bash /opt/aivo-deploy/distribute-one.sh "$TAG" "$WEB_REPO"

for svc in "${SVCS[@]}"; do
  if kubectl -n aivo get deployment "$svc" >/dev/null 2>&1; then
    echo "=== ensure imagePullPolicy=IfNotPresent: $svc ==="
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

if kubectl -n aivo get deployment web >/dev/null 2>&1; then
  echo "=== ensure imagePullPolicy=IfNotPresent: web ==="
  kubectl -n aivo patch deployment web --type='json' \
    -p='[{"op":"replace","path":"/spec/template/spec/containers/0/imagePullPolicy","value":"IfNotPresent"}]' \
    2>/dev/null || true
  echo "=== set image: web -> $TAG ==="
  kubectl -n aivo set image deployment/web "web=ghcr.io/artpromedia/web:$TAG"
  kubectl -n aivo rollout status deployment/web --timeout=300s
else
  echo "=== SKIP rollout (web): no deployment found ==="
fi

echo "=== rollout DONE ==="
kubectl -n aivo get pods -o wide | grep -E "$(IFS='|'; echo "${SVCS[*]}|web")"

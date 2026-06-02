#!/usr/bin/env bash
# Rollout jolly-wozniak deploy across the 5 services.
# Usage: bash rollout-jolly-wozniak.sh TAG
set -euo pipefail
TAG="${1:?tag required}"

# Distribute images: tenant-svc + data-governance-svc may not have k8s
# deployments yet — gracefully skip rollout for those but still
# distribute the image so it's cached. Audit-svc/identity-svc/integration-svc
# always have deployments named identically to the service.

ALL_SVCS=(audit-svc identity-svc tenant-svc data-governance-svc integration-svc)

for svc in "${ALL_SVCS[@]}"; do
  echo "=== distribute: $svc ==="
  bash /opt/aivo-deploy/distribute-one.sh "$TAG" "$svc"
done

# Patch + rollout only deployments that exist.
for svc in "${ALL_SVCS[@]}"; do
  if kubectl -n aivo get deployment "$svc" >/dev/null 2>&1; then
    echo "=== ensure imagePullPolicy=IfNotPresent: $svc ==="
    kubectl -n aivo patch deployment "$svc" --type='json' \
      -p='[{"op":"replace","path":"/spec/template/spec/containers/0/imagePullPolicy","value":"IfNotPresent"}]' \
      2>/dev/null || true
    echo "=== set image: $svc -> $TAG ==="
    kubectl -n aivo set image "deployment/$svc" "$svc=ghcr.io/artpromedia/$svc:$TAG"
    kubectl -n aivo rollout status "deployment/$svc" --timeout=180s
  else
    echo "=== SKIP rollout ($svc): no deployment found ==="
  fi
done

echo "=== rollout DONE ==="
kubectl -n aivo get pods -o wide | grep -E "audit-svc|identity-svc|tenant-svc|data-governance-svc|integration-svc"

#!/usr/bin/env bash
# Rollout sleepy-tesla deploy across 5 deployments.
# Image -> Deployment/Container map:
#   admin-svc      -> deployment admin-svc      / container admin-svc
#   audit-svc      -> deployment audit-svc      / container audit-svc
#   tenant-svc     -> deployment tenant-svc     / container tenant-svc
#   marketing      -> deployment marketing-svc  / container marketing
#   web            -> deployment web            / container web
# Usage: bash rollout-sleepy-tesla.sh TAG
set -euo pipefail
TAG="${1:?tag required}"

# image_name deployment_name container_name
TARGETS=(
  "admin-svc  admin-svc      admin-svc"
  "audit-svc  audit-svc      audit-svc"
  "tenant-svc tenant-svc     tenant-svc"
  "marketing  marketing-svc  marketing"
  "web        web            web"
)

# 1. Distribute all images to all 3 nodes.
for row in "${TARGETS[@]}"; do
  read -r img dep ctr <<<"$row"
  echo "=== distribute: $img ==="
  bash /opt/aivo-deploy/distribute-one.sh "$TAG" "$img"
done

# 2. Patch pull policy + set image + rollout status.
for row in "${TARGETS[@]}"; do
  read -r img dep ctr <<<"$row"
  if ! kubectl -n aivo get deployment "$dep" >/dev/null 2>&1; then
    echo "=== SKIP rollout ($dep): no deployment found ==="
    continue
  fi
  kubectl -n aivo patch deployment "$dep" --type='json' \
    -p='[{"op":"replace","path":"/spec/template/spec/containers/0/imagePullPolicy","value":"IfNotPresent"}]' \
    2>/dev/null || true
  echo "=== set image: $dep ($ctr) -> $img:$TAG ==="
  kubectl -n aivo set image "deployment/$dep" "$ctr=ghcr.io/artpromedia/$img:$TAG"
  kubectl -n aivo rollout status "deployment/$dep" --timeout=360s
done

echo "=== rollout DONE ==="
kubectl -n aivo get deployment admin-svc audit-svc tenant-svc marketing-svc web

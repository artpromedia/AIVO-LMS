#!/usr/bin/env bash
# Rollout vibrant-bardeen images for web, web-admin, billing-svc, identity-svc, comms-svc
set -e
TAG="$1"
if [ -z "$TAG" ]; then echo "Usage: $0 TAG"; exit 1; fi

# image-repo, deployment-name, container-name
TARGETS=(
  "web web web"
  "web-admin web-admin web-admin"
  "billing-svc billing-svc billing-svc"
  "identity-svc identity-svc identity-svc"
  "comms-svc comms-svc comms-svc"
)

echo "=== distribute images to k3s containerd ==="
for t in "${TARGETS[@]}"; do
  read -r img dep ctr <<<"$t"
  echo "--- distribute $img ---"
  bash /opt/aivo-deploy/distribute-one.sh "$TAG" "$img"
done

echo "=== rollout deployments ==="
for t in "${TARGETS[@]}"; do
  read -r img dep ctr <<<"$t"
  echo "--- $dep ($ctr -> ghcr.io/artpromedia/$img:$TAG) ---"
  # patch imagePullPolicy first (some default to Always)
  kubectl -n aivo patch deployment "$dep" --type=json \
    -p='[{"op":"replace","path":"/spec/template/spec/containers/0/imagePullPolicy","value":"IfNotPresent"}]' \
    2>/dev/null || true
  kubectl -n aivo set image deployment/"$dep" "$ctr=ghcr.io/artpromedia/$img:$TAG"
done

echo "=== wait for rollout status ==="
for t in "${TARGETS[@]}"; do
  read -r img dep ctr <<<"$t"
  echo "--- rollout status $dep ---"
  kubectl -n aivo rollout status deployment/"$dep" --timeout=8m || true
done

echo "=== final pod state ==="
for t in "${TARGETS[@]}"; do
  read -r img dep ctr <<<"$t"
  kubectl -n aivo get deploy "$dep" -o wide --no-headers 2>&1 | head -1
done

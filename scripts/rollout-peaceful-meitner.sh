#!/usr/bin/env bash
# Distribute + roll out peaceful-meitner images.
# Usage: bash rollout-peaceful-meitner.sh TAG
set -euo pipefail
TAG="${1:?tag required}"

SVCS="ai-svc billing-svc comms-svc engagement-svc family-svc identity-svc learning-svc tutor-svc web"

for svc in $SVCS; do
  echo "=== distribute $svc:$TAG ==="
  bash /opt/aivo-deploy/distribute-one.sh "$TAG" "$svc"
done

# Ensure imagePullPolicy=IfNotPresent on all 9 deployments so they use
# the locally-imported tags instead of pulling from ghcr.
echo "=== ensure imagePullPolicy=IfNotPresent ==="
for dep in $SVCS; do
  policy=$(kubectl -n aivo get deploy "$dep" -o jsonpath='{.spec.template.spec.containers[0].imagePullPolicy}')
  if [ "$policy" != "IfNotPresent" ]; then
    echo "patching $dep ($policy -> IfNotPresent)"
    kubectl -n aivo patch deployment "$dep" --type=json \
      -p='[{"op":"replace","path":"/spec/template/spec/containers/0/imagePullPolicy","value":"IfNotPresent"}]'
  fi
done

for dep in $SVCS; do
  echo "=== set image deployment/$dep $dep=ghcr.io/artpromedia/$dep:$TAG ==="
  kubectl -n aivo set image "deployment/$dep" "$dep=ghcr.io/artpromedia/$dep:$TAG"
done

echo "=== rollout status ==="
for dep in $SVCS; do
  kubectl -n aivo rollout status "deployment/$dep" --timeout=240s
done

echo "=== pods ==="
kubectl -n aivo get pods -o wide | grep -E '^(ai-svc|billing-svc|comms-svc|engagement-svc|family-svc|identity-svc|learning-svc|tutor-svc|web)-' | head -40

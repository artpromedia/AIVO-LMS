#!/usr/bin/env bash
# Build + distribute + roll out the 9 @aivo/security-fix services (commit 2a1a6701).
# reports-svc is built but skipped at rollout if no deployment exists.
set -e
TAG="$1"
if [ -z "$TAG" ]; then echo "Usage: $0 TAG"; exit 1; fi
cd /opt/aivo-deploy/AIVO-LMS

SVCS="responsible-ai-svc tenant-svc data-governance-svc problem-session-svc subject-brain-svc homework-svc math-recognizer-svc science-solver-svc reports-svc"

for svc in $SVCS; do
  echo "=== build $svc ==="
  docker build --build-arg SERVICE_NAME="$svc" -f docker/Dockerfile.service \
    -t "ghcr.io/artpromedia/$svc:$TAG" . 2>&1 | tail -4
done

echo "=== distribute + rollout ==="
for svc in $SVCS; do
  echo "--- distribute $svc ---"
  bash /opt/aivo-deploy/distribute-one.sh "$TAG" "$svc"
  if kubectl -n aivo get deployment "$svc" >/dev/null 2>&1; then
    kubectl -n aivo patch deployment "$svc" --type=json \
      --patch-file=/opt/aivo-deploy/pp-ifnotpresent.json 2>/dev/null || true
    kubectl -n aivo set image "deployment/$svc" "$svc=ghcr.io/artpromedia/$svc:$TAG"
  else
    echo "(no deployment $svc — image distributed only)"
  fi
done

echo "=== rollout status ==="
for svc in $SVCS; do
  kubectl -n aivo get deployment "$svc" >/dev/null 2>&1 || continue
  kubectl -n aivo rollout status "deployment/$svc" --timeout=6m || true
done

echo "=== final ==="
kubectl -n aivo get deploy $SVCS -o wide 2>/dev/null | awk '{print $1, $2, $7}' || true

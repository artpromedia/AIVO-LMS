#!/usr/bin/env bash
set -euo pipefail
TAG="${1:?tag required}"
SKIP_KEY_ENSURE="${SKIP_KEY_ENSURE:-0}"
cd /opt/aivo-deploy

# One-time: pin NEXT_SERVER_ACTIONS_ENCRYPTION_KEY on the web Deployment so
# Server Action IDs stay stable across pod replicas and redeploys.
# Done in bash (not the PS driver) to avoid PowerShell<->ssh quoting issues
# around the jsonpath expression.
if [ "$SKIP_KEY_ENSURE" != "1" ]; then
  echo "==> Ensuring NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is pinned"
  HAS_KEY="$(kubectl -n aivo get deployment/web \
    -o jsonpath='{.spec.template.spec.containers[?(@.name=="web")].env[?(@.name=="NEXT_SERVER_ACTIONS_ENCRYPTION_KEY")].name}' \
    2>/dev/null || true)"
  if [ -z "$HAS_KEY" ]; then
    echo "    setting new key (one-time)"
    KEY="$(openssl rand -base64 32)"
    kubectl -n aivo set env deployment/web "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$KEY"
  else
    echo "    already set — leaving as-is"
  fi
fi

echo "==> Extract"
rm -rf AIVO-LMS
mkdir AIVO-LMS
tar -xzf aivo-slim.tar.gz -C AIVO-LMS
cd AIVO-LMS
echo "==> Build web-v2 -> ghcr.io/artpromedia/web:$TAG"
docker build -f docker/Dockerfile.webapp \
  --build-arg APP_NAME=web-v2 \
  -t ghcr.io/artpromedia/web:latest \
  -t "ghcr.io/artpromedia/web:$TAG" \
  . 2>&1 | tail -40
echo "==> Distribute to all nodes"
bash scripts/distribute-one.sh "$TAG" web
echo "==> Roll out"
kubectl -n aivo set image deployment/web "web=ghcr.io/artpromedia/web:$TAG"
kubectl -n aivo rollout status deployment/web --timeout=240s
echo "$TAG" > /opt/aivo-deploy/TAG.web
echo "==> Pods"
kubectl -n aivo get pods -l app=web -o wide

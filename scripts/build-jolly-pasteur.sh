#!/usr/bin/env bash
# Build all images for jolly-pasteur deploy.
# Usage: bash build-jolly-pasteur.sh TAG
set -euo pipefail
TAG="${1:?tag required}"
cd /opt/aivo-deploy/AIVO-LMS

echo "=== [$(date +%H:%M:%S)] ai-svc (python) ==="
docker build --build-arg SERVICE_NAME=ai-svc -f docker/Dockerfile.python-service \
  -t ghcr.io/artpromedia/ai-svc:$TAG . 2>&1 | tail -3

echo "=== [$(date +%H:%M:%S)] family-svc (node) ==="
docker build --build-arg SERVICE_NAME=family-svc -f docker/Dockerfile.service \
  -t ghcr.io/artpromedia/family-svc:$TAG . 2>&1 | tail -3

echo "=== [$(date +%H:%M:%S)] integration-svc (node) ==="
docker build --build-arg SERVICE_NAME=integration-svc -f docker/Dockerfile.service \
  -t ghcr.io/artpromedia/integration-svc:$TAG . 2>&1 | tail -3

echo "=== [$(date +%H:%M:%S)] integrations-svc (node) ==="
docker build --build-arg SERVICE_NAME=integrations-svc -f docker/Dockerfile.service \
  -t ghcr.io/artpromedia/integrations-svc:$TAG . 2>&1 | tail -3

echo "=== [$(date +%H:%M:%S)] web (web-v2 webapp) ==="
docker build --build-arg APP_NAME=web-v2 -f docker/Dockerfile.webapp \
  -t ghcr.io/artpromedia/web:$TAG . 2>&1 | tail -3

echo "=== [$(date +%H:%M:%S)] all builds DONE ==="
docker images | grep "$TAG"
df -h / | tail -1

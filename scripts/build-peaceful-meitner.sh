#!/usr/bin/env bash
# Build all images for peaceful-meitner deploy.
# Usage: bash build-peaceful-meitner.sh TAG
set -euo pipefail
TAG="${1:?tag required}"
cd /opt/aivo-deploy/AIVO-LMS

build_node() {
  local svc="$1"
  echo "=== [$(date +%H:%M:%S)] $svc (node) ==="
  docker build --build-arg SERVICE_NAME="$svc" -f docker/Dockerfile.service \
    -t "ghcr.io/artpromedia/$svc:$TAG" . 2>&1 | tail -3
}

echo "=== [$(date +%H:%M:%S)] ai-svc (python) ==="
docker build --build-arg SERVICE_NAME=ai-svc -f docker/Dockerfile.python-service \
  -t ghcr.io/artpromedia/ai-svc:$TAG . 2>&1 | tail -3

build_node billing-svc
build_node comms-svc
build_node engagement-svc
build_node family-svc
build_node identity-svc
build_node learning-svc
build_node tutor-svc

echo "=== [$(date +%H:%M:%S)] web (web-v2 webapp) ==="
docker build --build-arg APP_NAME=web-v2 -f docker/Dockerfile.webapp \
  -t ghcr.io/artpromedia/web:$TAG . 2>&1 | tail -3

echo "=== [$(date +%H:%M:%S)] all builds DONE ==="
docker images | grep "$TAG"
df -h / | tail -1

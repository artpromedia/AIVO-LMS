#!/usr/bin/env bash
# Build elegant-maxwell deploy: 8 services + web.
# Usage: bash build-elegant-maxwell.sh TAG
set -euo pipefail
TAG="${1:?tag required}"
cd /opt/aivo-deploy/AIVO-LMS

build_node() {
  local svc="$1"
  echo "=== [$(date +%H:%M:%S)] $svc (node) ==="
  docker build --build-arg SERVICE_NAME="$svc" -f docker/Dockerfile.service \
    -t "ghcr.io/artpromedia/$svc:$TAG" . 2>&1 | tail -3
}

build_node admin-svc
build_node audit-svc
build_node billing-svc
build_node data-governance-svc
build_node identity-svc
build_node integration-svc
build_node learning-svc
build_node tenant-svc

echo "=== [$(date +%H:%M:%S)] web (webapp) ==="
docker build -f docker/Dockerfile.webapp --build-arg APP_NAME=web-v2 \
  -t "ghcr.io/artpromedia/web:$TAG" . 2>&1 | tail -3

echo "=== [$(date +%H:%M:%S)] all builds DONE ==="
docker images | grep "$TAG" | sort
df -h / | tail -1

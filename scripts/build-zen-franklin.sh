#!/usr/bin/env bash
# Build zen-franklin deploy: 6 node services (Sprints 7-10 RAI + status + impersonation + reports + tutor RAI gateway).
# Usage: bash build-zen-franklin.sh TAG
set -euo pipefail
TAG="${1:?tag required}"
cd /opt/aivo-deploy/AIVO-LMS

build_node() {
  local svc="$1"
  echo "=== [$(date +%H:%M:%S)] $svc (node) ==="
  docker build --build-arg SERVICE_NAME="$svc" -f docker/Dockerfile.service \
    -t "ghcr.io/artpromedia/$svc:$TAG" . 2>&1 | tail -3
}

build_node identity-svc
build_node tutor-svc
build_node responsible-ai-svc
build_node status-page-svc
build_node reports-svc
build_node alerts-proxy-svc

echo "=== [$(date +%H:%M:%S)] all builds DONE ==="
docker images | grep "$TAG" | sort
df -h / | tail -1

#!/usr/bin/env bash
# Build jolly-wozniak deploy: 5 services with BullMQ adapter + audit wiring.
# Usage: bash build-jolly-wozniak.sh TAG
set -euo pipefail
TAG="${1:?tag required}"
cd /opt/aivo-deploy/AIVO-LMS

build_node() {
  local svc="$1"
  echo "=== [$(date +%H:%M:%S)] $svc (node) ==="
  docker build --build-arg SERVICE_NAME="$svc" -f docker/Dockerfile.service \
    -t "ghcr.io/artpromedia/$svc:$TAG" . 2>&1 | tail -3
}

build_node audit-svc
build_node identity-svc
build_node tenant-svc
build_node data-governance-svc
build_node integration-svc

echo "=== [$(date +%H:%M:%S)] all builds DONE ==="
docker images | grep "$TAG" | sort
df -h / | tail -1

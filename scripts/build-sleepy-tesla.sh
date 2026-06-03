#!/usr/bin/env bash
# Build sleepy-tesla deploy:
#   - admin-svc / audit-svc / tenant-svc  (P0/P1/P2 enterprise polish)
#   - marketing app (hreflang SSR + middleware)
#   - web app (live-refresh hook + messages-inbox)
# Usage: bash build-sleepy-tesla.sh TAG
set -euo pipefail
TAG="${1:?tag required}"
cd /opt/aivo-deploy/AIVO-LMS

build_node() {
  local svc="$1"
  echo "=== [$(date +%H:%M:%S)] $svc (node) ==="
  docker build --build-arg SERVICE_NAME="$svc" -f docker/Dockerfile.service \
    -t "ghcr.io/artpromedia/$svc:$TAG" . 2>&1 | tail -3
}

build_webapp() {
  local app="$1"        # APP_NAME passed to next build (e.g. marketing, web-v2)
  local image="$2"      # ghcr image name (e.g. marketing, web)
  echo "=== [$(date +%H:%M:%S)] $app -> $image (webapp) ==="
  docker build --build-arg APP_NAME="$app" -f docker/Dockerfile.webapp \
    -t "ghcr.io/artpromedia/$image:$TAG" . 2>&1 | tail -3
}

build_node admin-svc
build_node audit-svc
build_node tenant-svc
build_webapp marketing marketing
build_webapp web-v2    web

echo "=== [$(date +%H:%M:%S)] all builds DONE ==="
docker images | grep "$TAG" | sort
df -h / | tail -1

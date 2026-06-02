#!/usr/bin/env bash
# Build all images for brave-sagan deploy.
# Usage: bash build-brave-sagan.sh TAG
set -euo pipefail
TAG="${1:?tag required}"
cd /opt/aivo-deploy/AIVO-LMS

build_node() {
  local svc="$1"
  echo "=== [$(date +%H:%M:%S)] $svc (node) ==="
  docker build --build-arg SERVICE_NAME="$svc" -f docker/Dockerfile.service \
    -t "ghcr.io/artpromedia/$svc:$TAG" . 2>&1 | tail -3
}

build_py() {
  local svc="$1"
  echo "=== [$(date +%H:%M:%S)] $svc (python) ==="
  docker build --build-arg SERVICE_NAME="$svc" -f docker/Dockerfile.python-service \
    -t "ghcr.io/artpromedia/$svc:$TAG" . 2>&1 | tail -3
}

# 11 node services touched by brave-sagan
build_node admin-svc
build_node assessment-svc
build_node comms-svc
build_node engagement-svc
build_node family-svc
build_node identity-svc
build_node integration-svc
build_node integrations-svc
build_node learning-svc
build_node subject-brain-svc
build_node tutor-svc

# 2 python services
build_py curriculum-svc
build_py speech-eval-svc

# 2 webapps
echo "=== [$(date +%H:%M:%S)] web (web-v2 webapp) ==="
docker build --build-arg APP_NAME=web-v2 -f docker/Dockerfile.webapp \
  -t "ghcr.io/artpromedia/web:$TAG" . 2>&1 | tail -3

echo "=== [$(date +%H:%M:%S)] marketing (marketing webapp) ==="
docker build --build-arg APP_NAME=marketing -f docker/Dockerfile.webapp \
  -t "ghcr.io/artpromedia/marketing:$TAG" . 2>&1 | tail -3

echo "=== [$(date +%H:%M:%S)] all builds DONE ==="
docker images | grep "$TAG" | sort
df -h / | tail -1

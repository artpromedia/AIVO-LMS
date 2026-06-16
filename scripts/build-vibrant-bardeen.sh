#!/usr/bin/env bash
set -e
TAG="$1"
if [ -z "$TAG" ]; then echo "Usage: $0 TAG"; exit 1; fi
cd /opt/aivo-deploy/AIVO-LMS

echo "=== build web (web-v2) ==="
docker build -f docker/Dockerfile.webapp --build-arg APP_NAME=web-v2 -t "ghcr.io/artpromedia/web:$TAG" . 2>&1 | tail -10

echo "=== build web-admin ==="
docker build -f docker/Dockerfile.webapp --build-arg APP_NAME=web-admin -t "ghcr.io/artpromedia/web-admin:$TAG" . 2>&1 | tail -10

for svc in billing-svc identity-svc comms-svc; do
  echo "=== build $svc ==="
  docker build --build-arg SERVICE_NAME="$svc" -f docker/Dockerfile.service -t "ghcr.io/artpromedia/$svc:$TAG" . 2>&1 | tail -10
done

echo "=== all built ==="
docker images | grep -E "^ghcr.io/artpromedia/(web|web-admin|billing-svc|identity-svc|comms-svc)\s+$TAG"

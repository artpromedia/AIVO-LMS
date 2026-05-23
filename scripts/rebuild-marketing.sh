#!/bin/bash
set -euo pipefail
cd /opt/aivo-deploy/AIVO-LMS
TAG="manual-$(date -u +%Y%m%d%H%M%S)"
echo "=== building marketing with tag $TAG ==="
docker build -f docker/Dockerfile.webapp --build-arg APP_NAME=marketing \
  -t "ghcr.io/artpromedia/marketing:$TAG" \
  -t "ghcr.io/artpromedia/marketing:latest" .
echo "$TAG" > /opt/aivo-deploy/TAG
echo "=== built tag: $TAG ==="

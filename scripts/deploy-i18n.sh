#!/bin/bash
set -euo pipefail

cd /opt/aivo-deploy
TAG="manual-$(date +%Y%m%d%H%M%S)"
echo "=== TAG: $TAG ==="

echo "=== extracting slim tarball ==="
rm -rf AIVO-LMS
mkdir AIVO-LMS
tar -xzf aivo-slim.tar.gz -C AIVO-LMS
cd AIVO-LMS

echo "=== confirming i18n files present ==="
ls apps/web-v2/lib/i18n/
ls apps/web-v2/lib/i18n/messages/ | head -12
ls apps/marketing/src/ 2>/dev/null | head -5

echo "=== building marketing image ==="
docker build -f docker/Dockerfile.webapp \
  --build-arg APP_NAME=marketing \
  -t ghcr.io/artpromedia/marketing:latest \
  -t "ghcr.io/artpromedia/marketing:$TAG" \
  . 2>&1 | tail -20

echo "=== building web-v2 image ==="
docker build -f docker/Dockerfile.webapp \
  --build-arg APP_NAME=web-v2 \
  -t ghcr.io/artpromedia/web:latest \
  -t "ghcr.io/artpromedia/web:$TAG" \
  . 2>&1 | tail -20

echo "$TAG" > /opt/aivo-deploy/TAG
echo "=== built tag: $TAG ==="

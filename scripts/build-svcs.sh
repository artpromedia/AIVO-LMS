#!/usr/bin/env bash
set -euo pipefail
TAG="$1"
shift
cd /opt/aivo-deploy/AIVO-LMS
for svc in "$@"; do
  echo "=== build $svc ==="
  docker build --build-arg SERVICE_NAME="$svc" -f docker/Dockerfile.service -t "ghcr.io/artpromedia/$svc:$TAG" . 2>&1 | tail -8
done
echo "=== all built ==="

#!/usr/bin/env bash
set -euo pipefail
TAG="${1:?tag required}"
cd /opt/aivo-deploy
echo "==> Extract"
rm -rf AIVO-LMS
mkdir AIVO-LMS
tar -xzf aivo-slim.tar.gz -C AIVO-LMS
cd AIVO-LMS
echo "==> Build web-v2 -> ghcr.io/artpromedia/web:$TAG"
docker build -f docker/Dockerfile.webapp \
  --build-arg APP_NAME=web-v2 \
  -t ghcr.io/artpromedia/web:latest \
  -t "ghcr.io/artpromedia/web:$TAG" \
  . 2>&1 | tail -40
echo "==> Distribute to all nodes"
bash scripts/distribute-one.sh "$TAG" web
echo "==> Roll out"
kubectl -n aivo set image deployment/web "web=ghcr.io/artpromedia/web:$TAG"
kubectl -n aivo rollout status deployment/web --timeout=240s
echo "$TAG" > /opt/aivo-deploy/TAG.web
echo "==> Pods"
kubectl -n aivo get pods -l app=web -o wide

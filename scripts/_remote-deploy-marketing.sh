#!/usr/bin/env bash
# Build + distribute + roll out apps/marketing on K3s @ Hetzner.
#
# Assumes the slim source tarball has already been extracted into
# /opt/aivo-deploy/AIVO-LMS by _remote-deploy-web.sh (or by an earlier
# run of this script). The Deployment in cluster is `marketing-svc` with
# image repo `ghcr.io/artpromedia/marketing`; container name `marketing`.
#
# Usage (server side):
#   bash _remote-deploy-marketing.sh TAG
set -euo pipefail
TAG="${1:?tag required}"
cd /opt/aivo-deploy

if [ ! -d AIVO-LMS ]; then
  echo "ERROR: /opt/aivo-deploy/AIVO-LMS not found — run _remote-deploy-web.sh first" >&2
  exit 1
fi
cd AIVO-LMS

echo "==> Build marketing -> ghcr.io/artpromedia/marketing:$TAG"
docker build -f docker/Dockerfile.webapp \
  --build-arg APP_NAME=marketing \
  -t ghcr.io/artpromedia/marketing:latest \
  -t "ghcr.io/artpromedia/marketing:$TAG" \
  . 2>&1 | tail -40

echo "==> Distribute to all nodes"
bash scripts/distribute-one.sh "$TAG" marketing

echo "==> Roll out marketing-svc"
kubectl -n aivo set image deployment/marketing-svc "marketing=ghcr.io/artpromedia/marketing:$TAG"
kubectl -n aivo rollout status deployment/marketing-svc --timeout=240s
echo "$TAG" > /opt/aivo-deploy/TAG.marketing

echo "==> Pods"
kubectl -n aivo get pods -l app.kubernetes.io/name=marketing-svc -o wide

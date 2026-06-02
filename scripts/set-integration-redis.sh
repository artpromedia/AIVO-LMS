#!/usr/bin/env bash
set -euo pipefail
TAG="${1:?usage: set-integration-redis.sh <tag>}"
NS="${NS:-aivo}"
IMG="ghcr.io/artpromedia/integration-svc:${TAG}"

URL=$(kubectl -n "$NS" get secret aivo-redis -o jsonpath='{.data.url}' | base64 -d)
if [ -z "$URL" ]; then echo "FATAL: aivo-redis secret has no url"; exit 1; fi

echo "=== set REDIS_URL env on deploy/integration-svc ==="
kubectl -n "$NS" set env deploy/integration-svc REDIS_URL="$URL"
# Also propagate to worker deployment if it exists
if kubectl -n "$NS" get deploy integration-svc-worker >/dev/null 2>&1; then
  echo "=== set REDIS_URL + ROLE env on deploy/integration-svc-worker ==="
  kubectl -n "$NS" set env deploy/integration-svc-worker REDIS_URL="$URL" ROLE=worker
fi

echo "=== set image on integration-svc -> $IMG ==="
kubectl -n "$NS" set image deploy/integration-svc integration-svc="$IMG"
kubectl -n "$NS" rollout status deploy/integration-svc --timeout=240s

if kubectl -n "$NS" get deploy integration-svc-worker >/dev/null 2>&1; then
  echo "=== set image on integration-svc-worker ==="
  kubectl -n "$NS" set image deploy/integration-svc-worker worker="$IMG" 2>/dev/null \
    || kubectl -n "$NS" set image deploy/integration-svc-worker integration-svc-worker="$IMG" 2>/dev/null \
    || echo "(could not set image on worker — container name unknown)"
  kubectl -n "$NS" rollout status deploy/integration-svc-worker --timeout=240s || true
fi

echo "=== pods ==="
kubectl -n "$NS" get pods -l app=integration-svc -o wide
echo "=== logs ==="
kubectl -n "$NS" logs deploy/integration-svc --tail=30 | grep -E 'SyncQueue|REDIS|listening' || true

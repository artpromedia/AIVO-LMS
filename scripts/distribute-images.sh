#!/bin/bash
set -euo pipefail

TAG="${1:?usage: distribute-images.sh TAG}"
IMAGES=("ghcr.io/artpromedia/marketing:$TAG" "ghcr.io/artpromedia/web:$TAG")
NODES=("10.0.0.2" "10.0.0.3" "10.0.0.4")  # app1, app2, ml1

for IMG in "${IMAGES[@]}"; do
  echo "=== distributing $IMG ==="
  TMP="/tmp/$(echo "$IMG" | tr '/:' '_').tar"
  docker save "$IMG" -o "$TMP"
  ls -lh "$TMP"
  for N in "${NODES[@]}"; do
    echo "--- import to $N ---"
    if [ "$N" = "10.0.0.2" ]; then
      # app1: local
      sudo k3s ctr images import "$TMP"
    else
      scp -o StrictHostKeyChecking=no "$TMP" "root@$N:$TMP"
      ssh -o StrictHostKeyChecking=no "root@$N" "k3s ctr images import $TMP && rm -f $TMP"
    fi
  done
  rm -f "$TMP"
done

echo "=== rollout ==="
kubectl -n aivo set image deployment/marketing-svc marketing="ghcr.io/artpromedia/marketing:$TAG"
kubectl -n aivo set image deployment/web web="ghcr.io/artpromedia/web:$TAG"
kubectl -n aivo rollout status deployment/marketing-svc --timeout=240s
kubectl -n aivo rollout status deployment/web --timeout=240s

echo "=== pods ==="
kubectl -n aivo get pod -l 'app.kubernetes.io/name in (marketing-svc,web)' -o wide

#!/bin/bash
set -euo pipefail

TAG="${1:?usage: distribute-one.sh TAG REPO}"
REPO="${2:?repo name (marketing or web)}"
IMG="ghcr.io/artpromedia/${REPO}:${TAG}"
TMP="/tmp/${REPO}-${TAG}.tar"

echo "=== save $IMG ==="
docker save "$IMG" -o "$TMP"
ls -lh "$TMP"

echo "=== import to app1 ==="
k3s ctr images import "$TMP"

for N in 10.0.0.3 10.0.0.4; do
  echo "=== import to $N ==="
  scp -o StrictHostKeyChecking=no "$TMP" "root@$N:$TMP"
  ssh -o StrictHostKeyChecking=no "root@$N" "k3s ctr images import $TMP && rm -f $TMP"
done
rm -f "$TMP"
echo "=== done $IMG ==="

#!/bin/bash
echo "=== app1 k3s images ==="
k3s ctr images list -q | grep artpromedia/web
echo "=== app1 docker images ==="
docker images ghcr.io/artpromedia/web --format '{{.Repository}}:{{.Tag}}'
for N in 10.0.0.3 10.0.0.4; do
  echo "=== $N k3s images ==="
  ssh -o StrictHostKeyChecking=no "root@$N" 'k3s ctr images list -q | grep artpromedia/web'
done

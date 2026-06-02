#!/usr/bin/env bash
# Distribute + roll out jolly-pasteur images.
# Usage: bash rollout-jolly-pasteur.sh TAG
set -euo pipefail
TAG="${1:?tag required}"

# Distribute (imports into k3s ctr + scp's to other nodes).
for svc in ai-svc family-svc integration-svc integrations-svc web; do
  echo "=== distribute $svc:$TAG ==="
  bash /opt/aivo-deploy/distribute-one.sh "$TAG" "$svc"
done

# Roll out. For each, set image; container name = deployment name for these.
declare -A DEPLOY_IMAGE=(
  [ai-svc]=ai-svc
  [family-svc]=family-svc
  [integration-svc]=integration-svc
  [integrations-svc]=integrations-svc
  [web]=web
)

# integrations-svc deployment defaults to imagePullPolicy: Always — must patch
# to IfNotPresent so it uses the locally-imported image instead of pulling from ghcr.
echo "=== patch integrations-svc imagePullPolicy=IfNotPresent ==="
kubectl -n aivo patch deployment integrations-svc --type=json \
  -p='[{"op":"replace","path":"/spec/template/spec/containers/0/imagePullPolicy","value":"IfNotPresent"}]'

for dep in "${!DEPLOY_IMAGE[@]}"; do
  image_repo="${DEPLOY_IMAGE[$dep]}"
  echo "=== set image deployment/$dep $dep=ghcr.io/artpromedia/$image_repo:$TAG ==="
  kubectl -n aivo set image "deployment/$dep" "$dep=ghcr.io/artpromedia/$image_repo:$TAG"
done

echo "=== rollout status ==="
for dep in ai-svc family-svc integration-svc integrations-svc web; do
  kubectl -n aivo rollout status "deployment/$dep" --timeout=180s
done

echo "=== pods ==="
kubectl -n aivo get pods -o wide | grep -E '^(ai-svc|family-svc|integration-svc|integrations-svc|web)-'

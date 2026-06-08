#!/usr/bin/env bash
# Pins web-admin to the most-recently-pulled image digest so both
# replicas serve the same Next.js build (otherwise their server-action
# IDs diverge → "Server Action not found" on /login).
#
# Background: deployment uses ghcr.io/artpromedia/web-admin:latest with
# imagePullPolicy=Always. The :latest tag in ghcr was re-pushed
# 2026-06-06 ~23:00Z; the pod that started before that kept the old
# digest, the pod that started after pulled the new one.
#
# This script:
#   1. Finds the digest the *newest* running pod is on.
#   2. Patches the deployment image to that exact @sha256 digest.
#   3. Restarts both pods so they converge on the pinned digest.
set -euo pipefail

NEW_DIGEST="$(kubectl -n aivo get pods -l app.kubernetes.io/name=web-admin \
  --field-selector=status.phase=Running \
  -o jsonpath='{range .items[*]}{.status.containerStatuses[0].state.running.startedAt}{"|"}{.status.containerStatuses[0].imageID}{"\n"}{end}' \
  | sort -r \
  | head -1 \
  | awk -F'|' '{print $2}' \
  | sed 's#^.*@##')"

if [[ -z "$NEW_DIGEST" || "$NEW_DIGEST" != sha256:* ]]; then
  echo "ERROR: could not resolve a digest, got: '$NEW_DIGEST'" >&2
  exit 1
fi

PINNED="ghcr.io/artpromedia/web-admin@$NEW_DIGEST"
echo "Pinning web-admin -> $PINNED"

kubectl -n aivo set image deployment/web-admin web-admin="$PINNED"
kubectl -n aivo rollout status deployment/web-admin --timeout=180s

echo
echo "=== final pod digests (should all match) ==="
for p in $(kubectl -n aivo get pods -l app.kubernetes.io/name=web-admin \
            --field-selector=status.phase=Running \
            -o jsonpath='{.items[*].metadata.name}'); do
  echo "--- $p ---"
  kubectl -n aivo get pod "$p" -o jsonpath='image={.spec.containers[0].image}{"\n"}imageID={.status.containerStatuses[0].imageID}{"\n"}'
done

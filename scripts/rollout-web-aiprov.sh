#!/usr/bin/env bash
# Roll out the new web image AND flip AI_PROVIDER=anthropic in ONE rollout
# (strategic-merge patch merges the env entry by name + sets the image), then
# wait and smoke-check boot. Usage: bash rollout-web-aiprov.sh <TAG>
set -euo pipefail
NS=aivo
TAG="${1:?usage: rollout-web-aiprov.sh <TAG>}"
IMG="ghcr.io/artpromedia/web:${TAG}"

echo "=== 1. distribute image to k3s containerd (+ other nodes) ==="
bash /opt/aivo-deploy/distribute-one.sh "$TAG" web

echo "=== 2. single-rollout patch: image=$IMG + AI_PROVIDER=anthropic ==="
cat > /tmp/web-aiprov-patch.json <<JSON
{"spec":{"template":{"spec":{"containers":[{"name":"web","image":"${IMG}","imagePullPolicy":"IfNotPresent","env":[{"name":"AI_PROVIDER","value":"anthropic"}]}]}}}}
JSON
kubectl -n "$NS" patch deployment web --type=strategic --patch-file /tmp/web-aiprov-patch.json

echo "=== 3. wait for rollout ==="
kubectl -n "$NS" rollout status deployment/web --timeout=300s

echo "=== 4. verify resolved env on the new pod ==="
POD=$(kubectl -n "$NS" get pods -l app.kubernetes.io/name=web --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1:].metadata.name}' 2>/dev/null)
[ -z "$POD" ] && POD=$(kubectl -n "$NS" get pods | awk '/^web-/{p=$1} END{print p}')
echo "pod: $POD"
kubectl -n "$NS" exec "$POD" -- sh -lc 'echo "AI_PROVIDER=$AI_PROVIDER NODE_ENV=$NODE_ENV ANTHROPIC_len=${#ANTHROPIC_API_KEY} OPENAI_len=${#OPENAI_API_KEY} GOOGLE_len=${#GOOGLE_API_KEY}"' || true

echo "=== 5. image + readiness ==="
kubectl -n "$NS" get deploy web -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
kubectl -n "$NS" get pods -l app.kubernetes.io/name=web

echo "=== 6. home smoke (in-cluster) ==="
kubectl -n "$NS" exec "$POD" -- sh -lc 'wget -qO- -S http://localhost:3000/ 2>&1 | head -1' || echo "(no wget — rely on readinessProbe = pod Ready)"
echo "DONE."

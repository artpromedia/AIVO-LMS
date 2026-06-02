#!/usr/bin/env bash
# Distribute + roll out brave-sagan images.
# Usage: bash rollout-brave-sagan.sh TAG
set -euo pipefail
TAG="${1:?tag required}"

# Pairs: <image-repo>:<deployment-name>:<container-name>
PAIRS=(
  "admin-svc:admin-svc:admin-svc"
  "assessment-svc:assessment-svc:assessment-svc"
  "comms-svc:comms-svc:comms-svc"
  "engagement-svc:engagement-svc:engagement-svc"
  "family-svc:family-svc:family-svc"
  "identity-svc:identity-svc:identity-svc"
  "integration-svc:integration-svc:integration-svc"
  "integrations-svc:integrations-svc:integrations-svc"
  "learning-svc:learning-svc:learning-svc"
  "subject-brain-svc:subject-brain-svc:subject-brain-svc"
  "tutor-svc:tutor-svc:tutor-svc"
  "curriculum-svc:curriculum-svc:curriculum-svc"
  "speech-eval-svc:speech-eval-svc:speech-eval-svc"
  "web:web:web"
  "marketing:marketing-svc:marketing"
)

echo "=== distribute ==="
for pair in "${PAIRS[@]}"; do
  repo="${pair%%:*}"
  echo "--- $repo:$TAG ---"
  bash /opt/aivo-deploy/distribute-one.sh "$TAG" "$repo"
done

echo "=== ensure imagePullPolicy=IfNotPresent ==="
for pair in "${PAIRS[@]}"; do
  IFS=':' read -r repo dep cont <<< "$pair"
  cur=$(kubectl -n aivo get deploy "$dep" -o jsonpath="{.spec.template.spec.containers[?(@.name==\"$cont\")].imagePullPolicy}")
  if [ "$cur" != "IfNotPresent" ]; then
    echo "patching $dep ($cur -> IfNotPresent)"
    idx=$(kubectl -n aivo get deploy "$dep" -o jsonpath="{range .spec.template.spec.containers[*]}{.name}{'\n'}{end}" | grep -n "^$cont$" | head -1 | cut -d: -f1)
    idx=$((idx-1))
    kubectl -n aivo patch deployment "$dep" --type=json \
      -p="[{\"op\":\"replace\",\"path\":\"/spec/template/spec/containers/$idx/imagePullPolicy\",\"value\":\"IfNotPresent\"}]"
  fi
done

echo "=== set image ==="
for pair in "${PAIRS[@]}"; do
  IFS=':' read -r repo dep cont <<< "$pair"
  echo "--- $dep $cont=ghcr.io/artpromedia/$repo:$TAG ---"
  kubectl -n aivo set image "deployment/$dep" "$cont=ghcr.io/artpromedia/$repo:$TAG"
done

echo "=== rollout status ==="
for pair in "${PAIRS[@]}"; do
  dep="${pair#*:}"; dep="${dep%%:*}"
  kubectl -n aivo rollout status "deployment/$dep" --timeout=300s || {
    echo "ROLLOUT FAILED: $dep"
    kubectl -n aivo describe deploy "$dep" | tail -20
    kubectl -n aivo get pods -l app="$dep" -o wide || true
    exit 1
  }
done

echo "=== pods ==="
kubectl -n aivo get pods -o wide | grep -E '^(admin-svc|assessment-svc|comms-svc|engagement-svc|family-svc|identity-svc|integration-svc|integrations-svc|learning-svc|subject-brain-svc|tutor-svc|curriculum-svc|speech-eval-svc|web|marketing)-' | head -60

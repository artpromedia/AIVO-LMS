#!/usr/bin/env bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
for ns in aivo aivo-staging; do
  echo "--- ns=$ns ---"
  if ! kubectl get ns "$ns" >/dev/null 2>&1; then
    echo "  namespace $ns does NOT exist"
    continue
  fi
  if ! kubectl -n "$ns" get secret aivo-common-env >/dev/null 2>&1; then
    echo "  aivo-common-env SECRET MISSING in $ns"
    continue
  fi
  keys=$(kubectl -n "$ns" get secret aivo-common-env -o json | jq -r '.data | keys[]' | grep -i SPEECH_BUDDY || true)
  if [ -z "$keys" ]; then
    echo "  no SPEECH_BUDDY_* keys in aivo-common-env"
  else
    echo "$keys" | sed 's/^/  HAS: /'
  fi
done

#!/usr/bin/env bash
# Diagnoses web-admin :latest tag drift across the 2 replicas.
set -euo pipefail
echo "=== deploy web-admin spec ==="
kubectl -n aivo get deploy web-admin -o jsonpath='imagePullPolicy={.spec.template.spec.containers[0].imagePullPolicy}{"\n"}strategy={.spec.strategy.type}{"\n"}maxSurge={.spec.strategy.rollingUpdate.maxSurge}{"\n"}maxUnavailable={.spec.strategy.rollingUpdate.maxUnavailable}{"\n"}replicas={.spec.replicas}{"\n"}'
echo
echo "=== running pods ==="
kubectl -n aivo get pods -l app=web-admin -o wide --no-headers
echo
echo "=== running pod -> image digest ==="
for p in $(kubectl -n aivo get pods -l app=web-admin --field-selector=status.phase=Running -o jsonpath='{.items[*].metadata.name}'); do
  echo "--- $p ---"
  kubectl -n aivo get pod "$p" -o jsonpath='node={.spec.nodeName} image={.spec.containers[0].image} imageID={.status.containerStatuses[0].imageID}{"\n"}'
done

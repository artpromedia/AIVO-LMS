#!/usr/bin/env bash
# Diagnose failing iep-progress-sync CronJob pods + under-replicated deployments.
set -uo pipefail

echo "=== under-replicated deployments ==="
kubectl -n aivo get deploy --no-headers | awk '{split($2,a,"/"); if (a[1]!=a[2]) print $1, $2}'

echo "=== iep-progress-sync cronjob ==="
kubectl -n aivo get cronjob | grep -i iep || echo "(no iep cronjob)"

POD=$(kubectl -n aivo get pods --no-headers --sort-by=.metadata.creationTimestamp | grep '^iep-progress-sync' | grep Error | tail -1 | awk '{print $1}')
if [ -n "${POD:-}" ]; then
  echo "=== logs from $POD ==="
  kubectl -n aivo logs "$POD" --tail=30 2>&1 | tail -30
  echo "=== pod image ==="
  kubectl -n aivo get pod "$POD" -o jsonpath='{.spec.containers[0].image}{"\n"}{.spec.containers[0].command}{"\n"}{.spec.containers[0].args}{"\n"}'
else
  echo "(no Error pods found)"
fi

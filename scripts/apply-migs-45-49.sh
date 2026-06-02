#!/usr/bin/env bash
set -euo pipefail
cd /opt/aivo-deploy
for N in 45 46 47 48 49; do
  SQL=$(ls 00${N}_*.sql)
  echo "=== applying 00${N} ($SQL) ==="
  # (re)create configmap from the SQL with key NN.sql
  kubectl -n aivo create cm mig-00${N} --from-file=00${N}.sql=${SQL} \
    --dry-run=client -o yaml | kubectl apply -f -
  # clean any prior job + apply fresh
  kubectl -n aivo delete job mig-00${N}-apply --ignore-not-found
  kubectl -n aivo apply -f mig-00${N}-job.yaml
  # wait
  kubectl -n aivo wait --for=condition=complete --timeout=180s job/mig-00${N}-apply
  echo "--- logs ---"
  kubectl -n aivo logs -l job-name=mig-00${N}-apply --tail=20
  echo
done
echo "ALL MIGRATIONS APPLIED"

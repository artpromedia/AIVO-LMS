#!/usr/bin/env bash
# Definitive: does billing-svc serve /api/billing/admin/pilots now?
# A no-token request should get 401 (route registered, auth-gated) — NOT 404.
# Runs a throwaway curl pod in-cluster against the billing-svc Service.
set -euo pipefail
kubectl -n aivo run pilots-route-probe-$RANDOM --rm -i --restart=Never \
  --image=curlimages/curl:8.10.1 -- \
  -s -o /dev/null -w 'pilots_route_http=%{http_code}\n' \
  http://billing-svc:3000/api/billing/admin/pilots

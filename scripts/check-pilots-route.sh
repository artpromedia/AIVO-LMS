#!/usr/bin/env bash
# Verify the billing-svc pilots route is registered (expect HTTP 401 auth-gate,
# NOT 404). Run ON aivo-app1.
set -euo pipefail
POD=$(kubectl -n aivo get pods -o name | grep billing-svc | head -1)
echo "pod: $POD"
kubectl -n aivo exec "$POD" -- sh -c \
  'wget -qS -O /dev/null http://localhost:3000/api/billing/admin/pilots 2>&1 | grep -i "HTTP/" | head -1 || echo "(no HTTP line)"'

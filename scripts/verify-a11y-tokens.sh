#!/usr/bin/env bash
# Decisive check: read the ACTUAL value of the overridden custom properties in
# the deployed compiled CSS. Old (failing) values mean the image predates the
# a11y change; new (dark) values mean the override shipped.
#   --aivo-status-success: #22c55e (old) -> #15803d (new)
#   --color-aivo-accent:   #fbbf24/oklch(.74) (old) -> #92400e (new)
set -uo pipefail
NS=aivo
POD=$(kubectl -n "$NS" get pods -l app.kubernetes.io/name=web --field-selector=status.phase=Running -o jsonpath='{.items[-1:].metadata.name}')
echo "pod: $POD"
kubectl -n "$NS" exec "$POD" -- sh -lc '
  cat /app/apps/web-v2/.next/static/css/*.css 2>/dev/null \
    | grep -o -E "\-\-aivo-status-success:[^;]*|\-\-aivo-color-status-success:[^;]*|\-\-color-aivo-accent:[^;}]*|\-\-aivo-color-text-muted:[^;]*|\-\-aivo-status-error:[^;]*" \
    | sort -u
'

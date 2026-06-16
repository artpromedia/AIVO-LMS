#!/usr/bin/env bash
# Verify the deployed web image actually contains the a11y contrast overrides
# by fetching the compiled CSS from inside the running pod and grepping for the
# darkened token hex values (#92400e accent, #15803d success, #b91c1c error).
set -uo pipefail
NS=aivo
POD=$(kubectl -n "$NS" get pods -l app.kubernetes.io/name=web --field-selector=status.phase=Running -o jsonpath='{.items[-1:].metadata.name}')
echo "pod: $POD"
# The standalone Next server bundles compiled CSS under .next/static/css.
echo "=== grep compiled CSS for override hexes ==="
kubectl -n "$NS" exec "$POD" -- sh -lc '
  found=0
  for f in /app/apps/web-v2/.next/static/css/*.css; do
    if grep -l -e "92400e" -e "15803d" -e "b91c1c" "$f" >/dev/null 2>&1; then
      echo "OVERRIDES FOUND in $(basename "$f")"
      grep -o -e "92400e" -e "15803d" -e "b45309" -e "b91c1c" -e "4b5563" "$f" | sort -u | tr "\n" " "
      echo ""
      found=1
    fi
  done
  if [ "$found" = "0" ]; then
    echo "NOT FOUND — image predates the a11y CSS change (cache reuse). Rebuild --no-cache."
  fi
'
echo "=== external smoke ==="
curl -s -o /dev/null -w 'home=%{http_code}\n' https://aivolearning.com/
curl -s -o /dev/null -w 'login=%{http_code}\n' https://aivolearning.com/login
echo "=== boot probe ==="
kubectl -n "$NS" logs "$POD" --tail=120 2>&1 | grep -Ei 'llm_config_probe|Ready in|error' | tail -n 5

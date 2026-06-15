#!/usr/bin/env bash
# set-web-sentry-dsn.sh — satisfy web-v2's Sprint A2 boot guard (env.ts:276).
#
# Patches SENTRY_DSN + NEXT_PUBLIC_SENTRY_DSN into:
#   1. aivo-common-env secret (prod + staging, graceful-skip) — survives helm deploys
#   2. web deployment explicit env — triggers the rollout that converges the
#      currently-crashlooping sha-bad39c74dc91 pod
#
# Usage: bash set-web-sentry-dsn.sh 'https://<key>@<org>.ingest.sentry.io/<project-id>'
#        echo "$DSN" | bash set-web-sentry-dsn.sh -      (read from stdin)
# Never prints the DSN — only a sha256[:12] fingerprint.
set -euo pipefail

DSN="${1:-}"
if [ "$DSN" = "-" ]; then
  read -r DSN
fi
# Windows pipes append CR; strip CR/LF and surrounding whitespace.
DSN="$(printf %s "$DSN" | tr -d '\r\n' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
if [ -z "$DSN" ]; then
  echo "Usage: $0 '<sentry-dsn-url>'   (or pipe DSN to: $0 -)" >&2
  exit 1
fi
case "$DSN" in
  https://*@*/*) : ;;
  *) echo "ERROR: doesn't look like a Sentry DSN (expected https://<key>@<host>/<project-id>)" >&2; exit 1 ;;
esac

FP=$(printf %s "$DSN" | sha256sum | cut -c1-12)
echo "DSN fingerprint sha256[:12]=$FP"

for NS in aivo aivo-staging; do
  if kubectl -n "$NS" get secret aivo-common-env >/dev/null 2>&1; then
    kubectl -n "$NS" patch secret aivo-common-env --type=merge \
      -p "{\"stringData\":{\"SENTRY_DSN\":\"$DSN\",\"NEXT_PUBLIC_SENTRY_DSN\":\"$DSN\"}}"
    echo "$NS/aivo-common-env patched"
  else
    echo "$NS: no aivo-common-env — skipped"
  fi
done

echo "=== set env on web deployment (triggers rollout) ==="
kubectl -n aivo set env deployment/web SENTRY_DSN="$DSN" NEXT_PUBLIC_SENTRY_DSN="$DSN"

echo "=== rollout status ==="
kubectl -n aivo rollout status deployment/web --timeout=8m

kubectl -n aivo get deploy web -o custom-columns='IMAGE:.spec.template.spec.containers[0].image,READY:.status.readyReplicas'
kubectl -n aivo get pods -o wide | grep ^web- | grep -v web-admin || true

echo "=== smoke ==="
curl -s -o /dev/null -w 'https://aivolearning.com/      -> %{http_code}\n' https://aivolearning.com/ || true
curl -s -o /dev/null -w 'https://aivolearning.com/login -> %{http_code}\n' https://aivolearning.com/login || true

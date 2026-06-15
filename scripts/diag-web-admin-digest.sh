#!/usr/bin/env bash
# Search web-admin pods for a Next.js error digest.
# Usage: bash diag-web-admin-digest.sh 2506150395
set -uo pipefail
DIGEST="${1:?usage: $0 <digest>}"
for p in $(kubectl -n aivo get pods --no-headers | grep '^web-admin' | grep Running | awk '{print $1}'); do
  echo "=== $p ==="
  kubectl -n aivo logs "$p" --since=60m 2>&1 | grep -B2 -A25 "$DIGEST" | head -60
done
echo "=== fallback: recent error lines (all web-admin pods) ==="
for p in $(kubectl -n aivo get pods --no-headers | grep '^web-admin' | grep Running | awk '{print $1}'); do
  echo "--- $p ---"
  kubectl -n aivo logs "$p" --since=60m 2>&1 | grep -iE 'error|digest' | tail -15
done

#!/usr/bin/env bash
# Check responsible-ai-svc: env wiring + whether @aivo/security exists in image.
set -uo pipefail
echo "=== envFrom + env names ==="
kubectl -n aivo get deploy responsible-ai-svc -o jsonpath='{range .spec.template.spec.containers[0].envFrom[*]}{.secretRef.name}{" "}{end}{"\n"}'
kubectl -n aivo get deploy responsible-ai-svc -o jsonpath='{range .spec.template.spec.containers[0].env[*]}{.name}{" "}{end}{"\n"}'
POD=$(kubectl -n aivo get pods --no-headers | grep '^responsible-ai-svc' | grep Running | head -1 | awk '{print $1}')
echo "=== pod: $POD ==="
echo "=== JWT_PUBLIC_KEY present? ==="
kubectl -n aivo exec "$POD" -- sh -c 'test -n "$JWT_PUBLIC_KEY" && echo YES || echo NO' 2>&1
echo "=== @aivo/security in node_modules? ==="
kubectl -n aivo exec "$POD" -- sh -c 'ls /app/node_modules/@aivo/ 2>/dev/null | head -20; ls /app/services/responsible-ai-svc/node_modules/@aivo/ 2>/dev/null | head -20' 2>&1
echo "=== recent rai-svc logs ==="
kubectl -n aivo logs "$POD" --since=30m --tail=10 2>&1 | tail -10

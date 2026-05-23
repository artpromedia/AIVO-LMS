#!/bin/bash
# Run on aivo-app1. Tails ingress-nginx logs while we curl externally.
set -u
POD=$(kubectl -n ingress-nginx get pods -l app.kubernetes.io/component=controller --field-selector=status.phase=Running -o name | head -1)
echo "POD=$POD"
echo "=== tailing for 10s ==="
kubectl -n ingress-nginx logs -f --tail=0 "$POD" --timestamps &
TAIL_PID=$!
sleep 2
echo "=== curl external ==="
curl -sI --max-time 8 https://aivolearning.com/ | head -3
echo "=== curl direct to app2 public via CF host header ==="
curl -sI -k --max-time 8 --resolve aivolearning.com:443:95.217.195.144 https://aivolearning.com/ | head -3
sleep 5
kill $TAIL_PID 2>/dev/null || true
wait 2>/dev/null
echo "=== done ==="

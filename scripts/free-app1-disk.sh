#!/bin/bash
# Runs on aivo-app1. Free disk; show before/after.
set -u
echo "=== BEFORE ==="
df -h /
echo
echo "=== docker prune ==="
docker system prune -af --volumes 2>&1 | tail -5 || true
echo
echo "=== containerd image cleanup (k3s uses containerd) ==="
k3s ctr images prune --all 2>&1 | tail -3 || true
crictl rmi --prune 2>&1 | tail -3 || true
echo
echo "=== journal vacuum ==="
journalctl --vacuum-time=2d 2>&1 | tail -3
echo
echo "=== evicted / failed pods ==="
kubectl get pods -A --field-selector=status.phase=Failed -o name 2>/dev/null | xargs -r kubectl delete --ignore-not-found 2>&1 | tail -5
kubectl get pods -A | awk '$4=="Evicted"{print "-n",$1,$2}' | xargs -r -L1 kubectl delete pod 2>&1 | tail -5
echo
echo "=== /var/log size ==="
du -sh /var/log/* 2>/dev/null | sort -h | tail -10
echo
echo "=== AFTER ==="
df -h /

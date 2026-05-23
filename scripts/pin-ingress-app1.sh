#!/bin/bash
# Run ON aivo-app1. Pin ingress-nginx-controller to this node.
set -euo pipefail

echo "=== current ingress pods ==="
kubectl -n ingress-nginx get pods -o wide

echo
echo "=== current deployment nodeSelector ==="
kubectl -n ingress-nginx get deploy ingress-nginx-controller -o jsonpath='{.spec.template.spec.nodeSelector}'; echo

echo
echo "=== patch: nodeSelector kubernetes.io/hostname=aivo-app1, replicas=1 ==="
kubectl -n ingress-nginx scale deploy ingress-nginx-controller --replicas=1
kubectl -n ingress-nginx patch deploy ingress-nginx-controller --type=merge -p '{"spec":{"template":{"spec":{"nodeSelector":{"kubernetes.io/hostname":"aivo-app1"}}}}}'

echo
echo "=== delete old pods to force fresh schedule ==="
kubectl -n ingress-nginx delete pod -l app.kubernetes.io/component=controller --ignore-not-found

echo
echo "=== wait for rollout (180s) ==="
kubectl -n ingress-nginx rollout status deploy/ingress-nginx-controller --timeout=180s

echo
echo "=== final pod state ==="
kubectl -n ingress-nginx get pods -o wide

#!/usr/bin/env bash
set -e
echo === namespaces ===
k3s ctr namespaces ls
echo === counts ===
for ns in $(k3s ctr namespaces ls -q); do
  echo -n "NS=$ns count="
  k3s ctr -n "$ns" images list -q | wc -l
done
echo === k8s.io top space ===
k3s ctr -n k8s.io images list 2>/dev/null | head -n 5
echo === df ===
df -h /
echo === containerd dir size ===
du -sh /var/lib/rancher/k3s/agent/containerd 2>/dev/null
du -sh /var/lib/containerd 2>/dev/null

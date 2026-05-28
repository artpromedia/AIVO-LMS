#!/usr/bin/env bash
echo === which ctr ===
which ctr
ctr --version 2>&1 || true
echo === namespaces ===
ctr namespaces ls 2>&1
echo === images all ns ===
for ns in $(ctr namespaces ls -q 2>/dev/null); do
  echo "--- NS=$ns ---"
  ctr -n "$ns" images ls 2>/dev/null | awk 'NR==1 || /artpromedia|web|nginx|ingress/' | head -n 30
  echo -n "count="
  ctr -n "$ns" images ls -q 2>/dev/null | wc -l
done
echo === sizes ===
du -sh /var/lib/containerd 2>/dev/null
du -sh /var/lib/rancher 2>/dev/null
echo === containerd config ===
[ -f /etc/containerd/config.toml ] && head -n 60 /etc/containerd/config.toml
echo === k3s service exec ===
ps -ef | grep -E 'k3s|containerd' | grep -v grep | head

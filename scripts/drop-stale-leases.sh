#!/usr/bin/env bash
set -e
LEASES=(
  2e43dc9d67618e0c6950a15d75aebd3eee3932d1632c22ab82259e955d984fe2
  42ae7db8f6931f5b253fb2c4e3fee706dae6f411ee695145515e10063730a41e
  52e27a7e8127d7fd8e08d2de7fbdafe4d92594a16befbedfb781570380320f2a
  558bff19049cd79d8b08addd4b32780026d5b05c7062f465de1d525d000f6c77
  caba9ff3074c1a16660e01b1c2dcbcea3c342abf9944da949f33ff4a573dcd0e
  e8c41d78f2818a20f83b08f6b1bd9a7d0a7e8bf99261f40a304ef00bfb55b3d1
)
for L in "${LEASES[@]}"; do
  echo "deleting lease $L"
  ctr -n k8s.io leases delete "$L" 2>&1 || true
done
echo "--- waiting for GC ---"
sleep 30
df -h /
du -xsh /var/lib/containerd
ctr -n k8s.io snapshots list 2>/dev/null | wc -l

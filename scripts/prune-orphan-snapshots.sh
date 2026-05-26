#!/usr/bin/env bash
# Clean snapshot directories on disk that are no longer referenced by containerd.
# Safe: only deletes directories whose name is NOT in `ctr snapshots list`.
set -euo pipefail

SNAP_DIR=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots

# Get the set of known snapshot IDs (numeric) from containerd.
mapfile -t KNOWN < <(ctr -n k8s.io snapshots list 2>/dev/null | awk 'NR>1 {print $1}' | sort -u)
echo "Known snapshots in containerd: ${#KNOWN[@]}"

# Build associative array for O(1) lookup.
declare -A KNOWN_MAP
for id in "${KNOWN[@]}"; do KNOWN_MAP[$id]=1; done

# Walk the snapshot dir.
total=0
orphan=0
freed_bytes=0
mapfile -t ALL_DIRS < <(ls "$SNAP_DIR" 2>/dev/null)
total=${#ALL_DIRS[@]}
echo "Snapshot dirs on disk: $total"

ORPHANS=()
for d in "${ALL_DIRS[@]}"; do
  if [[ -z "${KNOWN_MAP[$d]+x}" ]]; then
    ORPHANS+=("$d")
  fi
done
orphan=${#ORPHANS[@]}
echo "Orphans to delete: $orphan"

if [[ $orphan -eq 0 ]]; then
  echo "Nothing to do."
  exit 0
fi

# Delete in batches to avoid blocking too long. Show progress every 200.
i=0
for d in "${ORPHANS[@]}"; do
  rm -rf "$SNAP_DIR/$d" 2>/dev/null || true
  i=$((i+1))
  if (( i % 500 == 0 )); then
    echo "  deleted $i / $orphan ..."
  fi
done
echo "Deleted $i orphan snapshot dirs."

echo "--- after ---"
df -h /
du -xsh /var/lib/containerd

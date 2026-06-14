#!/usr/bin/env bash
# Find + remove stale workspace package dirs on the server deploy tree that are
# NOT in HEAD (tar never deletes, so old syncs leave package.json dirs that
# break `pnpm install --frozen-lockfile`). Pass --delete to actually remove.
set -euo pipefail
cd /opt/aivo-deploy/AIVO-LMS
tr -d '\r' < /opt/aivo-deploy/head-pkgs.txt > /tmp/head-pkgs.txt

DELETE="${1:-}"
found=0
for d in packages/*/ services/*/ apps/*/; do
  p="${d%/}"
  if [ -f "$p/package.json" ]; then
    if ! grep -qx "$p" /tmp/head-pkgs.txt; then
      found=1
      if [ "$DELETE" = "--delete" ]; then
        rm -rf "$p"
        echo "REMOVED: $p"
      else
        echo "STALE:   $p"
      fi
    fi
  fi
done
[ "$found" = "0" ] && echo "No stale workspace dirs."
exit 0

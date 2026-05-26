#!/usr/bin/env bash
# Remove containerd image tags that are no longer in use by any k8s deployment.
set -e
TAGS=(
  ghcr.io/artpromedia/web:manual-20260524091222
  ghcr.io/artpromedia/web:manual-20260524132023
  ghcr.io/artpromedia/web:manual-20260524203146
  ghcr.io/artpromedia/web:manual-20260525075523
  ghcr.io/artpromedia/web:manual-20260525091405
  ghcr.io/artpromedia/marketing:manual-20260523123802
  ghcr.io/artpromedia/marketing:manual-20260525075523
  ghcr.io/artpromedia/marketing:manual-20260525091405
  ghcr.io/artpromedia/learning-svc:manual-20260524123240
  ghcr.io/artpromedia/subject-brain-svc:manual-20260524203146
  ghcr.io/artpromedia/tutor-svc:k12-coverage-b0962463-20260525170953
)
for img in "${TAGS[@]}"; do
  echo "removing $img"
  ctr -n k8s.io images rm "$img" >/dev/null 2>&1 || true
done
echo "--- containerd GC ---"
ctr -n k8s.io content prune references 2>/dev/null || true
echo "--- after ---"
df -h /
du -xsh /var/lib/containerd

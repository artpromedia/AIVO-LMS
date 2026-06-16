#!/usr/bin/env bash
# Report whether the a11yfix web image built and whether a build is still running.
set -uo pipefail
source /opt/aivo-deploy/web-a11yfix-tag.env
echo "TAG=$TAG"
echo "=== image present? ==="
docker images "ghcr.io/artpromedia/web:$TAG" --format '{{.Repository}}:{{.Tag}} {{.Size}} {{.CreatedSince}}'
echo "=== build still running? ==="
if pgrep -af 'docker build' >/dev/null 2>&1; then
  pgrep -af 'docker build' | head -3
else
  echo "(no docker build process)"
fi
echo "=== disk ==="
df -h / | tail -1

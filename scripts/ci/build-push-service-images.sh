#!/usr/bin/env bash

set -euo pipefail

if (( $# < 2 )); then
  echo "usage: $0 <dockerfile> <service> [service ...]" >&2
  exit 2
fi

: "${IMAGE_PREFIX:?IMAGE_PREFIX is required}"
: "${GIT_COMMIT:?GIT_COMMIT is required}"

dockerfile="$1"
shift
build_arg_name="${BUILD_ARG_NAME:-SERVICE_NAME}"

is_transient_containerd_failure() {
  local log_file="$1"

  grep -Eiq \
    'failed to export layer|CreateDiff: mount callback failed|io\.containerd\.content\.v1\.content/ingest|failed to commit: rename .* no such file or directory' \
    "$log_file"
}

build_service() {
  local service="$1"
  local image="${IMAGE_PREFIX}/${service}:latest"
  local log_file
  local attempt

  log_file="$(mktemp)"

  for attempt in 1 2; do
    : >"$log_file"
    echo "=== Building ${service} (attempt ${attempt}/2) ==="

    if DOCKER_BUILDKIT=0 docker build \
      -f "$dockerfile" \
      --build-arg "${build_arg_name}=${service}" \
      --build-arg GIT_COMMIT="$GIT_COMMIT" \
      -t "$image" \
      . 2>&1 | tee "$log_file" | tail -10; then
      rm -f "$log_file"
      return 0
    fi

    if (( attempt == 2 )) || ! is_transient_containerd_failure "$log_file"; then
      echo "::error title=Docker build failed::${service} failed with a non-retryable build error"
      rm -f "$log_file"
      return 1
    fi

    echo "::warning title=Retrying containerd export failure::${service} hit a transient containerd content-store failure; retrying once"
    docker image rm "$image" >/dev/null 2>&1 || true
    sleep 10
  done
}

for service in "$@"; do
  if ! build_service "$service"; then
    exit 1
  fi
  echo "=== Pushing ${service} ==="
  docker push "${IMAGE_PREFIX}/${service}:latest" 2>&1 | tail -3
done

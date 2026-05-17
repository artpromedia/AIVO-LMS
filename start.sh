#!/usr/bin/env bash
# Production start script for the Replit autoscale deployment.
#
# This is the deploy's entry point (referenced from `.replit` as
# `run = ["bash", "start.sh"]`). It launches the marketing Next.js
# server on the port that Replit's autoscale runner gives us via $PORT
# (defaulting to 5000 if unset, matching the dev convention).
#
# We bind to 0.0.0.0 so the container's load balancer can reach us; binding
# to localhost would silently fail the health check.
set -euo pipefail

PORT="${PORT:-5000}"

cd "$(dirname "$0")/apps/marketing"

exec ./node_modules/.bin/next start --port "$PORT" --hostname 0.0.0.0

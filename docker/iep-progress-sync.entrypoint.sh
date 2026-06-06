#!/bin/sh
# Entrypoint for the IEP progress-sync worker. Runs on the brain-svc image,
# which sets PYTHONPATH=/app/src, so the module import resolves cleanly.
set -eu
exec python -m brain_svc.jobs.iep_progress_sync

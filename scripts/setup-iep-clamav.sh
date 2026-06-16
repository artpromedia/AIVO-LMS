#!/usr/bin/env bash
# setup-iep-clamav.sh — deploy in-cluster ClamAV + enable AV scanning for IEP uploads.
#
# assessment-svc POST /api/iep/upload-pdf streams uploads to clamd
# (services/assessment-svc/src/lib/av-scan.ts). Scanning is OPT-IN via CLAMAV_HOST.
# In prod (NODE_ENV=production) it FAILS CLOSED: once CLAMAV_HOST is set, a clamd
# outage makes IEP uploads return 503. So this script deploys clamd, PROVES it
# detects the EICAR test file *through the Service* (the exact path assessment-svc
# uses), and only THEN flips CLAMAV_HOST. If the proof fails, it aborts WITHOUT
# touching assessment-svc, so IEP uploads keep working (scan stays skipped).
#
# Run from a host with kubectl + cluster access (e.g. aivo-app1):
#   scp infra/k8s/base/clamav.yaml scripts/setup-iep-clamav.sh root@95.216.245.40:/opt/aivo-deploy/
#   ssh root@95.216.245.40 'bash /opt/aivo-deploy/setup-iep-clamav.sh'
#
# To DISABLE later (revert to skip-scan, uploads proceed):
#   kubectl -n aivo set env deployment/assessment-svc CLAMAV_HOST- CLAMAV_PORT- CLAMAV_TIMEOUT_MS-
#
# Overridable via env: NS, MANIFEST.
set -euo pipefail

NS="${NS:-aivo}"
MANIFEST="${MANIFEST:-/opt/aivo-deploy/clamav.yaml}"
CLAMAV_SVC="clamav.${NS}.svc.cluster.local"

echo "=== apply ClamAV manifest ==="
kubectl apply -f "$MANIFEST"

echo "=== wait for clamav rollout (first start loads the signature DB) ==="
kubectl -n "$NS" rollout status deployment/clamav --timeout=8m

echo "=== EICAR test through the clamav Service (proves the exact INSTREAM path) ==="
# Standard EICAR antivirus test string, base64-encoded so it is decoded ONLY
# inside the test pod (and so it can't trip a scanner mid-transit). The client
# speaks clamd INSTREAM exactly like av-scan.ts: zINSTREAM\0, then a 4-byte
# big-endian length + chunk, then a zero-length terminator; expects "... FOUND".
EICAR_B64="WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo="
RUN_OUT=$(kubectl -n "$NS" run "clamav-eicar-$RANDOM" --rm -i --restart=Never \
  --image=python:3.12-alpine \
  --env "EICAR_B64=$EICAR_B64" \
  --env "CLAMAV_SVC=$CLAMAV_SVC" \
  --command -- python3 -c '
import base64, os, socket, struct, sys
data = base64.b64decode(os.environ["EICAR_B64"])
s = socket.create_connection((os.environ["CLAMAV_SVC"], 3310), timeout=20)
s.sendall(b"zINSTREAM\0")
s.sendall(struct.pack("!L", len(data)) + data)
s.sendall(struct.pack("!L", 0))
resp = s.recv(4096).decode("utf-8", "replace")
print("clamd reply:", resp.strip())
sys.exit(0 if "FOUND" in resp else 1)
' 2>&1) || true
printf "%s\n" "$RUN_OUT"
if ! printf "%s" "$RUN_OUT" | grep -q 'FOUND'; then
  echo "FATAL: EICAR scan did not return FOUND — clamd not ready/working." >&2
  echo "       NOT enabling CLAMAV_HOST (IEP uploads keep working, scan stays skipped)." >&2
  exit 1
fi
echo "ClamAV verified: EICAR detected via $CLAMAV_SVC:3310."

echo "=== enable AV on assessment-svc (fail-closed in prod) ==="
kubectl -n "$NS" set env deployment/assessment-svc \
  CLAMAV_HOST="$CLAMAV_SVC" \
  CLAMAV_PORT=3310 \
  CLAMAV_TIMEOUT_MS=15000
kubectl -n "$NS" rollout status deployment/assessment-svc --timeout=5m

echo "=== pods ==="
kubectl -n "$NS" get pods --no-headers | grep -e clamav -e assessment-svc || true

echo
echo "DONE. IEP PDF uploads are now virus-scanned by clamd at $CLAMAV_SVC:3310."
echo "Policy: infected → 422 av_infected; scanner unreachable → 503 av_unavailable"
echo "(fail-closed in prod). Disable with:"
echo "  kubectl -n $NS set env deployment/assessment-svc CLAMAV_HOST- CLAMAV_PORT- CLAMAV_TIMEOUT_MS-"

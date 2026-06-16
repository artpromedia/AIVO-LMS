#!/usr/bin/env bash
# set-identity-avatar-s3.sh — point identity-svc avatar storage at in-cluster MinIO.
#
# Fixes profile-photo ("picture") upload failures in prod. identity-svc runs 2
# replicas, but services/identity-svc/src/lib/avatar-storage.ts defaults to
# pod-local disk (AVATAR_STORAGE_DIR): an avatar written to pod A 404s when the
# /api/avatars/... GET load-balances to pod B, and is lost on restart. Setting
# AVATAR_S3_BUCKET flips the backend to the in-cluster MinIO so both replicas
# share durable state.
#
# Real cluster facts (discovered 2026-06-16 — the HETZNER guide was a template):
#   * MinIO runs IN-CLUSTER: service `minio` (ns aivo), endpoint
#     http://minio.aivo.svc.cluster.local:9000. There is no native 10.0.0.3 MinIO
#     and no `r2-secrets`.
#   * Admin creds live in secret `minio-root` (keys MINIO_ROOT_USER /
#     MINIO_ROOT_PASSWORD). The MinIO image has no `mc`, so admin ops run in a
#     one-shot `minio/mc` pod.
#   * A bucket `avatars` was already provisioned, but identity-svc was never
#     pointed at it.
#
# Rather than hand identity-svc the MinIO ROOT credentials (full admin over every
# bucket — backups, exports, content-assets…), this creates a least-privilege
# MinIO service account scoped to ONLY the avatars bucket, PROVES an actual
# put/get/delete with it, and only then wires identity-svc:
#   1. Ensure the `avatars` bucket exists + create/refresh a scoped svcacct
#      (access key `aivo-avatar-svc`, random secret) via a one-shot minio/mc pod.
#   2. VALIDATE put/get/delete with the scoped creds — abort if it fails, so a
#      broken backend is never half-wired onto the running service.
#   3. Seed AVATAR_S3_ACCESS_KEY_ID + AVATAR_S3_SECRET_ACCESS_KEY into the
#      aivo-common-env secret (identity-svc reads it via envFrom; survives helm
#      redeploys). Values never printed — only sha256[:12] fingerprints.
#   4. Set the non-secret AVATAR_S3_* envs on the deployment (triggers a rollout
#      that loads the creds from envFrom). Same values are baked into
#      deploy-hetzner.yml so pipeline/helm deploys keep them.
#
# Run from a host with kubectl + cluster access (e.g. aivo-app1):
#   scp scripts/set-identity-avatar-s3.sh root@95.216.245.40:/opt/aivo-deploy/
#   ssh root@95.216.245.40 'bash /opt/aivo-deploy/set-identity-avatar-s3.sh'
#
# Overridable via env: NS, BUCKET, REGION, AVATAR_ACCESS_KEY, MC_IMAGE.
set -euo pipefail

NS="${NS:-aivo}"
BUCKET="${BUCKET:-avatars}"
EP_HOST="minio.${NS}.svc.cluster.local:9000"
ENDPOINT="http://${EP_HOST}"
REGION="${REGION:-us-east-1}"
AVATAR_ACCESS_KEY="${AVATAR_ACCESS_KEY:-aivo-avatar-svc}"
MC_IMAGE="${MC_IMAGE:-minio/mc}"

echo "=== read MinIO root creds from $NS/minio-root ==="
RU=$(kubectl -n "$NS" get secret minio-root -o jsonpath='{.data.MINIO_ROOT_USER}' 2>/dev/null | base64 -d || true)
RP=$(kubectl -n "$NS" get secret minio-root -o jsonpath='{.data.MINIO_ROOT_PASSWORD}' 2>/dev/null | base64 -d || true)
if [ -z "$RU" ] || [ -z "$RP" ]; then
  echo "FATAL: $NS/minio-root missing MINIO_ROOT_USER / MINIO_ROOT_PASSWORD." >&2
  echo "       Inspect keys: kubectl -n $NS get secret minio-root -o jsonpath='{.data}'" >&2
  exit 1
fi

# Strong secret for the scoped service account (hex → URL-safe; never printed).
# 32 chars (128-bit) — MinIO svcacct secret keys must be 8–40 chars.
AVATAR_SECRET_KEY=$(openssl rand -hex 16)

# Least-privilege policy: list the avatars bucket + read/write/delete its objects.
# Mirrors exactly what avatar-storage.ts uses (PutObject/GetObject/DeleteObject[s]
# + ListObjectsV2). Minified to survive transit as a single pod env var.
POLICY='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:ListBucket"],"Resource":["arn:aws:s3:::'"$BUCKET"'"]},{"Effect":"Allow","Action":["s3:PutObject","s3:GetObject","s3:DeleteObject"],"Resource":["arn:aws:s3:::'"$BUCKET"'/*"]}]}'

echo "=== ensure bucket '$BUCKET' + scoped svcacct '$AVATAR_ACCESS_KEY' (one-shot $MC_IMAGE pod) ==="
# All secret material is passed as pod env; the inner script is single-quoted so
# nothing expands server-side. mc auto-configures aliases from MC_HOST_<alias>.
# Validation uses the SCOPED alias so we prove the least-privilege creds can
# actually serve avatars before touching identity-svc.
RUN_OUT=$(kubectl -n "$NS" run "mc-avatar-setup-$RANDOM" --rm -i --restart=Never \
  --image="$MC_IMAGE" \
  --env "MC_HOST_admin=http://${RU}:${RP}@${EP_HOST}" \
  --env "MC_HOST_scoped=http://${AVATAR_ACCESS_KEY}:${AVATAR_SECRET_KEY}@${EP_HOST}" \
  --env "PARENT_USER=${RU}" \
  --env "BUCKET=${BUCKET}" \
  --env "AK=${AVATAR_ACCESS_KEY}" \
  --env "SK=${AVATAR_SECRET_KEY}" \
  --env "POLICY=${POLICY}" \
  --command -- sh -c '
    set -e
    mc mb "admin/$BUCKET" >/dev/null 2>&1 || true
    printf "%s" "$POLICY" > /tmp/avatar-policy.json
    mc admin user svcacct rm admin "$AK" >/dev/null 2>&1 || true
    mc admin user svcacct add admin "$PARENT_USER" --access-key "$AK" --secret-key "$SK" --policy /tmp/avatar-policy.json >/dev/null
    sleep 1
    echo healthcheck > /tmp/h.txt
    mc cp /tmp/h.txt "scoped/$BUCKET/__healthcheck.txt" >/dev/null
    mc stat "scoped/$BUCKET/__healthcheck.txt" >/dev/null
    mc rm "scoped/$BUCKET/__healthcheck.txt" >/dev/null
    echo VALIDATION_OK
  ' 2>&1) || true
printf "%s\n" "$RUN_OUT" | grep -v 'VALIDATION_OK' || true
if ! printf "%s" "$RUN_OUT" | grep -q 'VALIDATION_OK'; then
  echo "FATAL: MinIO bucket/svcacct setup or validation FAILED — NOT touching identity-svc." >&2
  exit 1
fi
echo "scoped svcacct validated: put/get/delete on '$BUCKET' OK (secret sha256[:12]=$(printf %s "$AVATAR_SECRET_KEY" | sha256sum | cut -c1-12))"

echo "=== seed scoped creds into $NS/aivo-common-env (durable, envFrom) ==="
# python3 emits correctly-escaped JSON; --patch-file keeps values off the cmdline.
PATCH_FILE=$(mktemp)
trap 'rm -f "$PATCH_FILE"' EXIT
AK_V="$AVATAR_ACCESS_KEY" SK_V="$AVATAR_SECRET_KEY" python3 -c \
  'import json,os; print(json.dumps({"stringData":{"AVATAR_S3_ACCESS_KEY_ID":os.environ["AK_V"],"AVATAR_S3_SECRET_ACCESS_KEY":os.environ["SK_V"]}}))' \
  > "$PATCH_FILE"
kubectl -n "$NS" patch secret aivo-common-env --type=merge --patch-file "$PATCH_FILE"
echo "$NS/aivo-common-env patched (AVATAR_S3_ACCESS_KEY_ID=$AVATAR_ACCESS_KEY)"

echo "=== set non-secret AVATAR_S3_* envs on deploy/identity-svc (triggers rollout) ==="
# Creds (ACCESS_KEY_ID/SECRET_ACCESS_KEY) intentionally NOT set inline — they
# load from aivo-common-env (envFrom), which the rollout below re-reads.
kubectl -n "$NS" set env deployment/identity-svc \
  AVATAR_S3_BUCKET="$BUCKET" \
  AVATAR_S3_ENDPOINT="$ENDPOINT" \
  AVATAR_S3_REGION="$REGION" \
  AVATAR_S3_FORCE_PATH_STYLE=true

echo "=== rollout status ==="
kubectl -n "$NS" rollout status deployment/identity-svc --timeout=5m

echo "=== pods ==="
kubectl -n "$NS" get pods -l app=identity-svc -o wide 2>/dev/null \
  || kubectl -n "$NS" get pods | grep '^identity-svc' || true

echo
echo "DONE. identity-svc avatars now on MinIO bucket '$BUCKET' at $ENDPOINT (scoped svcacct '$AVATAR_ACCESS_KEY')."
echo "Verify: upload a profile photo (parent/teacher/admin Settings), then refresh the"
echo "returned /api/avatars/<userId>/<file> URL several times — every request must 200"
echo "(previously one of the two replicas 404'd because the file lived only on the other)."

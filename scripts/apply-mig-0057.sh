#!/usr/bin/env bash
# Apply migration 0057_content_packs.sql to aivo prod DB via a one-shot Job.
# Idempotent (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
set -euo pipefail

MIG=/opt/aivo-deploy/AIVO-LMS/packages/db/drizzle/0057_content_packs.sql
CM=mig-0057-content-packs
JOB=mig-0057-content-packs-job

test -f "$MIG"

kubectl -n aivo delete cm "$CM" --ignore-not-found
kubectl -n aivo delete job "$JOB" --ignore-not-found

kubectl -n aivo create configmap "$CM" --from-file="0057.sql=$MIG"

cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: $JOB
  namespace: aivo
spec:
  backoffLimit: 1
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: psql
        image: postgres:16-alpine
        command: ["sh","-lc","psql \"\$PGURL\" -v ON_ERROR_STOP=1 -f /migs/0057.sql"]
        env:
        - name: PGURL
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: database-url
        volumeMounts:
        - { name: migs, mountPath: /migs }
      volumes:
      - name: migs
        configMap: { name: $CM }
EOF

kubectl -n aivo wait --for=condition=complete --timeout=120s job/$JOB || {
  echo "--- Job failed; logs ---"
  kubectl -n aivo logs job/$JOB || true
  exit 1
}
kubectl -n aivo logs job/$JOB | tail -40
echo "--- verify ---"
kubectl -n aivo run pg-verify-0057 --rm -i --restart=Never --image=postgres:16-alpine \
  --env="PGURL=$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)" \
  -- psql "\$PGURL" -tAc "SELECT to_regclass('public.content_packs');"

#!/usr/bin/env bash
# Apply migration 0060 (school-admin persistence) via k8s Job.
# Idempotent (CREATE TABLE/INDEX IF NOT EXISTS).
set -euo pipefail
NS="${NS:-aivo}"
SRC="${SRC:-/opt/aivo-deploy/AIVO-LMS/packages/db/drizzle}"
JOB="mig-0060-$(date +%s)"

kubectl -n "$NS" create configmap "$JOB-sql" \
  --from-file=0060_school_admin_persistence.sql="$SRC/0060_school_admin_persistence.sql"

cat <<EOF | kubectl -n "$NS" apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: $JOB
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 1800
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: psql
        image: postgres:15-alpine
        command:
        - /bin/sh
        - -c
        - |
          set -e
          echo "=== 0060_school_admin_persistence.sql ==="
          psql "\$DATABASE_URL" -v ON_ERROR_STOP=1 -f /sql/0060_school_admin_persistence.sql
          echo "=== DONE ==="
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: database-url
        volumeMounts:
        - name: sql
          mountPath: /sql
      volumes:
      - name: sql
        configMap:
          name: $JOB-sql
EOF

echo "Job: $JOB"
kubectl -n "$NS" wait --for=condition=complete --timeout=120s "job/$JOB" || \
  kubectl -n "$NS" wait --for=condition=failed --timeout=10s "job/$JOB" || true
kubectl -n "$NS" logs "job/$JOB" --tail=100
kubectl -n "$NS" delete configmap "$JOB-sql" --ignore-not-found

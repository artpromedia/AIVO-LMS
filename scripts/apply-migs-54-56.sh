#!/usr/bin/env bash
# Apply migrations 0054-0056 (peaceful-meitner merge) via k8s Job.
# All migrations are idempotent (CREATE TABLE/INDEX IF NOT EXISTS).
set -euo pipefail

NS="${NS:-aivo}"
SRC="${SRC:-/opt/aivo-deploy/AIVO-LMS/packages/db/drizzle}"
JOB="mig-54-56-$(date +%s)"

# Create ConfigMap with the three SQL files.
kubectl -n "$NS" create configmap "$JOB-sql" \
  --from-file=0054_speech_buddy_consents.sql="$SRC/0054_speech_buddy_consents.sql" \
  --from-file=0055_messaging.sql="$SRC/0055_messaging.sql" \
  --from-file=0056_user_roles.sql="$SRC/0056_user_roles.sql"

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
          echo "=== 0054_speech_buddy_consents.sql ==="
          psql "\$DATABASE_URL" -v ON_ERROR_STOP=1 -f /sql/0054_speech_buddy_consents.sql
          echo "=== 0055_messaging.sql ==="
          psql "\$DATABASE_URL" -v ON_ERROR_STOP=1 -f /sql/0055_messaging.sql
          echo "=== 0056_user_roles.sql ==="
          psql "\$DATABASE_URL" -v ON_ERROR_STOP=1 -f /sql/0056_user_roles.sql
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
kubectl -n "$NS" logs "job/$JOB" --tail=200
kubectl -n "$NS" delete configmap "$JOB-sql" --ignore-not-found

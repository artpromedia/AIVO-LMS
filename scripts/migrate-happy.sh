#!/usr/bin/env bash
set -e
cd /opt/aivo-deploy/AIVO-LMS/packages/db/drizzle
kubectl -n aivo delete job aivo-migrate-happy --ignore-not-found
kubectl -n aivo delete cm aivo-migrate-happy --ignore-not-found
kubectl -n aivo create cm aivo-migrate-happy \
  --from-file=0044_email_outbox.sql=0044_email_outbox.sql
cat <<'YAML' | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: aivo-migrate-happy
  namespace: aivo
spec:
  ttlSecondsAfterFinished: 600
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: psql
        image: postgres:16-alpine
        env:
        - name: PGURL
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: database-url
        volumeMounts:
        - name: migs
          mountPath: /migs
        command: ["/bin/sh","-c"]
        args:
        - |
          set -e
          for f in $(ls /migs/*.sql | sort); do
            echo "===applying $(basename $f)==="
            psql "$PGURL" -v ON_ERROR_STOP=1 -f "$f" 2>&1 | tail -40
          done
          echo "===DONE==="
      volumes:
      - name: migs
        configMap:
          name: aivo-migrate-happy
YAML
kubectl -n aivo wait --for=condition=complete --timeout=180s job/aivo-migrate-happy || kubectl -n aivo wait --for=condition=failed --timeout=10s job/aivo-migrate-happy || true
echo "---logs---"
kubectl -n aivo logs -l job-name=aivo-migrate-happy --tail=200

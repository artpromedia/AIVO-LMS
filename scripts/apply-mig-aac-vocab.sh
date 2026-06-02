#!/bin/bash
# Apply Sprint 3 (jolly-pasteur) AAC vocabulary migration 0046_aac_vocabulary.sql
# (lives in packages/db/migrations/, not drizzle/).
set -euo pipefail

SRC=/opt/aivo-deploy/AIVO-LMS/packages/db/migrations/0046_aac_vocabulary.sql
test -f "$SRC" || { echo "Missing $SRC"; exit 1; }

# ConfigMap from the SQL file
kubectl -n aivo create configmap mig-aac-vocab \
  --from-file=0046_aac_vocabulary.sql="$SRC" \
  --dry-run=client -o yaml | kubectl apply -f -

JOB=mig-aac-vocab-$(date +%s)
cat <<YAML | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: $JOB
  namespace: aivo
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 600
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: psql
          image: postgres:15-alpine
          command: ["/bin/sh","-c"]
          args:
            - |
              set -e
              psql "\$PGURL" -v ON_ERROR_STOP=1 -f /migs/0046_aac_vocabulary.sql
              echo DONE
          env:
            - name: PGURL
              valueFrom:
                secretKeyRef:
                  name: db-secrets
                  key: database-url
          volumeMounts:
            - name: migs
              mountPath: /migs
      volumes:
        - name: migs
          configMap:
            name: mig-aac-vocab
YAML

kubectl -n aivo wait --for=condition=complete --timeout=180s job/$JOB
kubectl -n aivo logs job/$JOB --tail=40

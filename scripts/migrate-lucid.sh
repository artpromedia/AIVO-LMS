#!/usr/bin/env bash
set -e
cd /opt/aivo-deploy/AIVO-LMS/packages/db/drizzle
cp /opt/aivo-deploy/preconditions-lucid.sql ./0040b_preconditions_lucid.sql
kubectl -n aivo delete job aivo-migrate-lucid --ignore-not-found
kubectl -n aivo delete cm aivo-migrate-lucid --ignore-not-found
kubectl -n aivo create cm aivo-migrate-lucid \
  --from-file=0028_backfill_missing_tables.sql=0028_backfill_missing_tables.sql \
  --from-file=0040b_preconditions_lucid.sql=0040b_preconditions_lucid.sql \
  --from-file=0041_school_admin_role.sql=0041_school_admin_role.sql \
  --from-file=0042_teacher_parent_invites.sql=0042_teacher_parent_invites.sql \
  --from-file=0043_learner_teachers_classroom.sql=0043_learner_teachers_classroom.sql
cat <<'YAML' | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: aivo-migrate-lucid
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
          name: aivo-migrate-lucid
YAML
kubectl -n aivo wait --for=condition=complete --timeout=300s job/aivo-migrate-lucid || kubectl -n aivo wait --for=condition=failed --timeout=10s job/aivo-migrate-lucid || true
echo "---logs---"
kubectl -n aivo logs -l job-name=aivo-migrate-lucid --tail=300

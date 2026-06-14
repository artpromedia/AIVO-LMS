#!/usr/bin/env bash
# Apply 0117 + backfill existing plaintext learner PINs into
# learner_pin_credentials (Argon2id) BEFORE 0118 drops users.pin.
# Run ON aivo-app1:  bash /opt/aivo-deploy/run-backfill-learner-pins.sh
#
# argon2 is a NATIVE module (can't be esbuild-bundled), so the Job pulls it
# with `npm i argon2` at start, then runs the bundled backfill. Bundle is
# ConfigMap-mounted (same ARG_MAX-safe pattern as the pilots seed).
set -euo pipefail
BUNDLE=/opt/aivo-deploy/backfill-learner-pins.cjs
NS=aivo
CM=backfill-pins-bundle
JOB=backfill-pins-job
[ -f "$BUNDLE" ] || { echo "FATAL: $BUNDLE missing (scp it first)"; exit 1; }

kubectl -n "$NS" delete job "$JOB" --ignore-not-found
kubectl -n "$NS" delete configmap "$CM" --ignore-not-found
kubectl -n "$NS" create configmap "$CM" --from-file=backfill.cjs="$BUNDLE"

cat > /tmp/backfill-pins-job.yaml <<'YAML'
apiVersion: batch/v1
kind: Job
metadata:
  name: backfill-pins-job
  namespace: aivo
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 600
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: backfill
          image: node:22-alpine
          command: ["sh", "-c"]
          args:
            - >
              cd /tmp && npm init -y >/dev/null 2>&1 &&
              npm install argon2@0.44.0 --no-audit --no-fund >/tmp/npm.log 2>&1 &&
              cp /backfill/backfill.cjs /tmp/backfill.cjs &&
              node /tmp/backfill.cjs
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-secrets
                  key: database-url
          volumeMounts:
            - name: bundle
              mountPath: /backfill
              readOnly: true
      volumes:
        - name: bundle
          configMap:
            name: backfill-pins-bundle
YAML
kubectl -n "$NS" apply -f /tmp/backfill-pins-job.yaml

echo "== waiting for backfill Job (timeout 5m) =="
kubectl -n "$NS" wait --for=condition=complete job/"$JOB" --timeout=300s \
  || { echo "Job did not complete; logs:"; kubectl -n "$NS" logs job/"$JOB" --tail=60; \
       kubectl -n "$NS" delete configmap "$CM" --ignore-not-found; rm -f /tmp/backfill-pins-job.yaml; exit 1; }

echo "== backfill Job logs =="
kubectl -n "$NS" logs job/"$JOB" --tail=60
kubectl -n "$NS" delete configmap "$CM" --ignore-not-found
rm -f /tmp/backfill-pins-job.yaml
echo "DONE."

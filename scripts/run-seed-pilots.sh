#!/usr/bin/env bash
# Run the pilots seed against PROD — run ON aivo-app1:
#   bash /opt/aivo-deploy/run-seed-pilots.sh
#
# The seed (packages/db/src/seed-pilots.ts) is pre-bundled to a single
# self-contained CJS file (esbuild, no native deps) at
# /opt/aivo-deploy/seed-pilots.cjs. It runs in an in-cluster node:22-alpine pod
# so it reaches the prod DB at 10.0.0.1 with the cluster's DATABASE_URL secret.
#
# The 550 KB bundle is delivered via a ConfigMap mount (the base64-in-env path
# blew ARG_MAX: "kubectl: Argument list too long"). The Job mounts the CM at
# /seed and runs `node /seed/seed-pilots.cjs`.
#
# Idempotent: the seed deletes its own tagged rows (provisioned_by='pilot_seed'
# + deterministic id prefixes) per tenant and re-inserts, so re-running lands on
# the same counts. It prints a per-pilot verification table at the end.
set -euo pipefail

BUNDLE=/opt/aivo-deploy/seed-pilots.cjs
NS=aivo
CM=seed-pilots-bundle
JOB=seed-pilots-job
[ -f "$BUNDLE" ] || { echo "FATAL: $BUNDLE missing (scp it first)"; exit 1; }

# Clean any prior run.
kubectl -n "$NS" delete job "$JOB" --ignore-not-found
kubectl -n "$NS" delete configmap "$CM" --ignore-not-found

# Ship the bundle as a ConfigMap.
kubectl -n "$NS" create configmap "$CM" --from-file=seed-pilots.cjs="$BUNDLE"

# Job: node:22-alpine, DATABASE_URL from db-secrets, bundle mounted read-only.
cat > /tmp/seed-pilots-job.yaml <<'YAML'
apiVersion: batch/v1
kind: Job
metadata:
  name: seed-pilots-job
  namespace: aivo
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 600
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: seed
          image: node:22-alpine
          command: ["node", "/seed/seed-pilots.cjs"]
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-secrets
                  key: database-url
          volumeMounts:
            - name: bundle
              mountPath: /seed
              readOnly: true
      volumes:
        - name: bundle
          configMap:
            name: seed-pilots-bundle
YAML
kubectl -n "$NS" apply -f /tmp/seed-pilots-job.yaml

echo "== waiting for the seed Job to complete (timeout 5m) =="
kubectl -n "$NS" wait --for=condition=complete job/"$JOB" --timeout=300s \
  || { echo "Job did not complete; logs below:"; kubectl -n "$NS" logs job/"$JOB" --tail=80; \
       kubectl -n "$NS" delete configmap "$CM" --ignore-not-found; \
       rm -f /tmp/seed-pilots-job.yaml; exit 1; }

echo "== seed Job logs (verification table) =="
kubectl -n "$NS" logs job/"$JOB" --tail=120

# Cleanup (Job auto-deletes via ttl; drop the CM now).
kubectl -n "$NS" delete configmap "$CM" --ignore-not-found
rm -f /tmp/seed-pilots-job.yaml
echo "DONE."

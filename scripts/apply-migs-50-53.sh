#!/bin/bash
# Apply migrations 0050, 0051, 0053 (skip 0052 — already applied).
# Mounts SQL files as a ConfigMap and runs psql in a one-shot Job.
set -euo pipefail
NS=aivo
PGURL=$(kubectl -n $NS get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)

apply() {
  local n="$1"
  local file="$2"
  local cm="migs-$n-cm"
  echo "=== applying $n ==="
  kubectl -n $NS delete configmap "$cm" --ignore-not-found
  kubectl -n $NS create configmap "$cm" --from-file=mig.sql="$file"
  cat <<EOF | kubectl -n $NS apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: migs-$n-job
spec:
  ttlSecondsAfterFinished: 60
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: psql
          image: postgres:15-alpine
          env:
            - name: PGURL
              valueFrom:
                secretKeyRef:
                  name: db-secrets
                  key: database-url
          command: ["sh", "-c"]
          args:
            - 'psql "\$PGURL" -v ON_ERROR_STOP=1 -f /migs/mig.sql'
          volumeMounts:
            - name: migs
              mountPath: /migs
      volumes:
        - name: migs
          configMap:
            name: $cm
EOF
  kubectl -n $NS wait --for=condition=complete --timeout=180s job/migs-$n-job
  kubectl -n $NS logs job/migs-$n-job | tail -20
  kubectl -n $NS delete job migs-$n-job --ignore-not-found
  kubectl -n $NS delete configmap "$cm" --ignore-not-found
}

apply 0050 /opt/aivo-deploy/migs/0050_web_domain_rls.sql
apply 0051 /opt/aivo-deploy/migs/0051_oidc_grants.sql
apply 0053 /opt/aivo-deploy/migs/0053_device_tokens.sql

echo === verifying ===
kubectl -n $NS run psql-verify-$$ --rm -i --restart=Never --image=postgres:15-alpine \
  --env=PGURL="$PGURL" --command -- \
  psql "$PGURL" -At -c "
SELECT 'oidc_grants', to_regclass('public.oidc_grants');
SELECT 'device_tokens', to_regclass('public.device_tokens');
SELECT 'rls_count_web', count(*) FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'web_%' AND rowsecurity=true;
"

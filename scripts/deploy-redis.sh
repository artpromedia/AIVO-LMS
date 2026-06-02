#!/usr/bin/env bash
# Deploy a single-node Redis to the aivo namespace for BullMQ (integration-svc).
# Idempotent: re-applies the manifest + recreates the aivo-redis secret if missing.
set -euo pipefail

NS="${NS:-aivo}"
REDIS_PASSWORD="${REDIS_PASSWORD:-$(openssl rand -hex 16)}"

kubectl get ns "$NS" >/dev/null 2>&1 || kubectl create namespace "$NS"

# Secret: aivo-redis.url = redis://:<pwd>@redis.aivo.svc.cluster.local:6379
URL="redis://:${REDIS_PASSWORD}@redis.${NS}.svc.cluster.local:6379"
if kubectl -n "$NS" get secret aivo-redis >/dev/null 2>&1; then
  echo "secret aivo-redis exists; reading password from it"
  EXISTING_URL=$(kubectl -n "$NS" get secret aivo-redis -o jsonpath='{.data.url}' | base64 -d)
  if [ -n "$EXISTING_URL" ]; then
    URL="$EXISTING_URL"
    REDIS_PASSWORD=$(echo "$URL" | sed -E 's|^redis://:([^@]+)@.*|\1|')
  fi
else
  kubectl -n "$NS" create secret generic aivo-redis \
    --from-literal=url="$URL" \
    --from-literal=password="$REDIS_PASSWORD"
  echo "created secret aivo-redis"
fi

cat <<YAML | kubectl -n "$NS" apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-data
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 5Gi
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-config
data:
  redis.conf: |
    appendonly yes
    appendfsync everysec
    maxmemory 512mb
    maxmemory-policy noeviction
    requirepass ${REDIS_PASSWORD}
    save 900 1
    save 300 10
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  labels: { app: redis }
spec:
  replicas: 1
  strategy: { type: Recreate }
  selector:
    matchLabels: { app: redis }
  template:
    metadata:
      labels: { app: redis }
    spec:
      containers:
        - name: redis
          image: redis:7.4-alpine
          command: ["redis-server", "/etc/redis/redis.conf"]
          ports:
            - { name: redis, containerPort: 6379 }
          volumeMounts:
            - { name: data, mountPath: /data }
            - { name: config, mountPath: /etc/redis }
          readinessProbe:
            exec: { command: ["redis-cli", "-a", "${REDIS_PASSWORD}", "--no-auth-warning", "PING"] }
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            exec: { command: ["redis-cli", "-a", "${REDIS_PASSWORD}", "--no-auth-warning", "PING"] }
            initialDelaySeconds: 15
            periodSeconds: 20
          resources:
            requests: { cpu: 100m, memory: 128Mi }
            limits:   { cpu: "1",  memory: 768Mi }
      volumes:
        - name: data
          persistentVolumeClaim: { claimName: redis-data }
        - name: config
          configMap: { name: redis-config }
---
apiVersion: v1
kind: Service
metadata:
  name: redis
spec:
  selector: { app: redis }
  ports:
    - { name: redis, port: 6379, targetPort: 6379 }
YAML

echo "waiting for redis rollout..."
kubectl -n "$NS" rollout status deploy/redis --timeout=180s
echo "=== redis pods ==="
kubectl -n "$NS" get pods -l app=redis -o wide
echo "=== redis service ==="
kubectl -n "$NS" get svc redis
echo "=== ping ==="
kubectl -n "$NS" exec deploy/redis -- redis-cli -a "$REDIS_PASSWORD" --no-auth-warning PING
echo "REDIS_URL stored in secret aivo-redis (key 'url')."

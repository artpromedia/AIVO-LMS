# AIVO Platform — Hetzner Deployment Guide

## Overview

This guide migrates AIVO from GCP (GKE + Cloud SQL + Memorystore) to **4 Hetzner dedicated servers** running K3s, self-managed PostgreSQL, and Redis.

### Server Inventory

| Role              | Server   | Location | CPU                              | RAM            | Storage                     | Cost         | Notes                                      |
| ----------------- | -------- | -------- | -------------------------------- | -------------- | --------------------------- | ------------ | ------------------------------------------ |
| **DB**            | Server 1 | HEL1     | Xeon W-2145 (8C/16T @ 4.5GHz)    | 128 GB **ECC** | 2×1.92TB **Datacenter SSD** | $81.90/mo    | ECC RAM, DC-grade SSDs, 3.84TB total       |
| **App Primary**   | Server 2 | HEL1     | i9-9900K (8C/16T @ 5.0GHz)       | 128 GB         | 2×1TB NVMe                  | $53.90/mo    | Fastest single-thread, K3s control plane   |
| **App Secondary** | Server 3 | HEL1     | i7-8700 (6C/12T @ 4.6GHz)        | 128 GB         | 3×1TB NVMe                  | $51.90/mo    | 3rd drive for MinIO/backups                |
| **ML Node**       | Server 4 | HEL1     | Ryzen 9 5950X (16C/32T @ 4.9GHz) | 128 GB **ECC** | 2×3.84TB **Datacenter SSD** | ~$105/mo     | ECC RAM, DC-grade SSDs, 7.68TB total, iNIC |
|                   |          |          |                                  |                |                             | **~$293/mo** |                                            |

> ✅ **Same Campus:** All 4 servers are in **HEL1** (Helsinki, Finland).
> This enables **Hetzner vSwitch** for the private network — free, <1ms latency,
> no VPN overhead. The Xeon W-2145 provides ECC memory for database reliability
> and datacenter-grade SSDs (5-10× write endurance vs consumer NVMe) for PostgreSQL.
> The i9-9900K's 5.0GHz turbo makes it the best single-thread CPU for the K3s
> control plane and TypeScript services. The **Ryzen 9 5950X** (16C/32T @ 4.9GHz)
> with ECC RAM is the dedicated ML node — its massive core count, ECC memory for
> model weight integrity, and 7.68TB of datacenter SSDs provide enterprise-grade
> reliability for all 1 Python AI service (ai-svc) without contesting the TypeScript app servers.

### Architecture

```
                         Internet
                            │
                       Cloudflare
                   (CDN + WAF + DNS)
                   + R2 / Workers / KV
                            │
                   ┌────────┴────────┐
                   ▼                 ▼
              Server 2           Server 3
            (App Primary)      (App Secondary)
   ┌──────── HEL1 ──────────┐  ┌──── HEL1 ──────┐
   │ i9-9900K / 128GB / 2TB │  │ i7-8700/128GB   │
   │ 8C/16T @ 5.0GHz       │  │ 6C/12T / 3TB    │
   │ K3s Server (ctrl plane)│  │ K3s Agent       │
   │ Ingress-NGINX          │  │ Replica pods    │
   │ Monitoring             │  │ MinIO (3rd SSD) │
   │ 9 TypeScript services │  │ Backup mirror   │
   └────────┬───────────────┘  └───────┬─────────┘
            │                          │
            └────────┬─────────────────┘
                     │
              vSwitch VLAN (HEL1)
              10.0.0.0/24  (<1ms)
                     │
            ┌────────┼─────────────────┐
            ▼                          ▼
       Server 1                   Server 4
     (Database Node)             (ML Node)
   ┌──────── HEL1 ──────────────┐  ┌──────── HEL1 ──────────────┐
   │ Xeon W-2145 8C/16T @ 4.5GHz│  │ Ryzen 9 5950X              │
   │ 128GB ECC DDR4             │  │ 16C/32T @ 4.9GHz           │
   │ 2×1.92TB Datacenter SSD    │  │ 128GB ECC / 2×3.84TB DC SSD│
   │ (3.84TB — enterprise grade)│  │ (7.68TB — enterprise grade)│
   │ PostgreSQL 15 + PgBouncer  │  │ 1 Python AI service (ai-svc)   │
   │ Redis 7                    │  │ K3s Agent (role=ml)         │
   └────────────────────────────┘  └────────────────────────────┘
```

> **Why this is optimal:** All 4 servers in HEL1 with vSwitch gives <1ms latency.
> The i9-9900K's 5.0GHz turbo runs the K3s control plane and 9 TypeScript services.
> The Xeon W-2145 + ECC RAM + datacenter SSDs make the ideal database server —
> DC SSDs have 5-10× write endurance vs consumer NVMe, critical for PostgreSQL WAL.
> 3.84TB DB storage means no Hetzner Storage Box needed for backups.
> Redis on the DB server provides sub-millisecond caching for auth tokens and sessions.
> The **Ryzen 9 5950X** with 16C/32T + ECC RAM offloads the Python AI ML
> services from the app servers — its ECC memory prevents silent data corruption
> in model weights, and 7.68TB of DC-grade SSDs provide massive model cache
> and LoRA adapter storage with enterprise write endurance.
> The i7-8700's bonus 3rd drive hosts MinIO object storage and backup mirrors.

---

## Phase 1: Server Provisioning & OS Setup

### 1.1 Order Servers from Hetzner Robot

All 4 servers should already be ordered. Ensure:

- OS: **Ubuntu 24.04 LTS** (or Debian 12)
- All in **HEL1** (Helsinki) for low-latency private networking via vSwitch

### 1.2 Initial OS Setup (All 4 Servers)

SSH into each server and run:

```bash
# Update system
apt update && apt upgrade -y

# Set hostname
hostnamectl set-hostname aivo-db1      # Server 1
hostnamectl set-hostname aivo-app1     # Server 2
hostnamectl set-hostname aivo-app2     # Server 3
hostnamectl set-hostname aivo-ml1      # Server 4

# Set timezone
timedatectl set-timezone UTC

# Install essentials
apt install -y curl wget git htop iotop net-tools \
  ufw fail2ban unattended-upgrades apt-transport-https \
  ca-certificates gnupg lsb-release jq

# Create deploy user
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
echo "deploy ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/deploy

# SSH hardening
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# Configure firewall (adjust after vSwitch setup)
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw enable
```

### 1.3 Configure Hetzner vSwitch (Private Network)

All 4 servers are in **HEL1**, so a single vSwitch spans all of them with <1ms latency.

1. Go to **Hetzner Robot → vSwitch → Create vSwitch**
2. VLAN ID: `4000` (or any available)
3. Add **all 4 servers** to the vSwitch

On each server, configure the private network interface:

```bash
# Find the network interface (usually enp0s31f6 or similar)
ip link show

# Create VLAN interface — /etc/network/interfaces.d/vswitch
cat > /etc/network/interfaces.d/vswitch << 'EOF'
auto enp0s31f6.4000
iface enp0s31f6.4000 inet static
    address 10.0.0.X/24    # .1 for DB, .2 for App1, .3 for App2, .4 for ML
    vlan-raw-device enp0s31f6
    mtu 1400
EOF

# Bring up the interface
ifup enp0s31f6.4000

# Test connectivity between servers
ping 10.0.0.1  # from app servers → DB
ping 10.0.0.2  # from any server → App1
ping 10.0.0.3  # from any server → App2
ping 10.0.0.4  # from any server → ML Node
```

### 1.4 Disk Setup

**Server 1 (Database — Xeon W-2145, 2×1.92TB Datacenter SSD, HEL1):**

```bash
# SSD 1 (1.92TB DC) — OS + PostgreSQL primary data
# Already mounted at / — PostgreSQL data goes in /data/postgres
mkdir -p /data/postgres
chown postgres:postgres /data/postgres

# SSD 2 (1.92TB DC) — Redis + WAL archive + local backups
mkfs.ext4 /dev/sdb
mkdir -p /data/secondary
mount /dev/sdb /data/secondary
echo '/dev/sdb /data/secondary ext4 defaults,noatime 0 2' >> /etc/fstab

# Create subdirectories on SSD 2
mkdir -p /data/secondary/redis
mkdir -p /data/secondary/backups
mkdir -p /data/secondary/wal-archive

# Symlinks for convenience
ln -s /data/secondary/redis /data/redis
ln -s /data/secondary/backups /data/backups
```

> **Storage Budget (3.84TB total — very comfortable):**
>
> - SSD 1 (1.92TB DC): ~100GB OS + PostgreSQL data = **~1.8TB headroom** 🟢
> - SSD 2 (1.92TB DC): ~16GB Redis + WAL + backups = **~1.7TB headroom** 🟢
>
> With 3.84TB of datacenter-grade SSD, you can keep **90+ days of local backups**
> without needing a Hetzner Storage Box. DC SSDs have 5-10× write endurance vs
> consumer NVMe — critical for PostgreSQL WAL writes and checkpoint I/O.
> Monitor with `df -h /data/postgres`.

**Server 2 (App Primary — i9-9900K, 2×1TB NVMe, HEL1):**

```bash
# SSD 1 (1TB NVMe) — OS + K3s + containers (already mounted at /)
mkdir -p /data/k3s

# SSD 2 (1TB NVMe) — K3s persistent volumes + monitoring
mkfs.ext4 /dev/nvme1n1
mkdir -p /data/k3s-data
mount /dev/nvme1n1 /data/k3s-data
echo '/dev/nvme1n1 /data/k3s-data ext4 defaults,noatime 0 2' >> /etc/fstab

# Subdirectories
mkdir -p /data/k3s-data/monitoring   # Prometheus, Loki, Grafana
mkdir -p /data/k3s-data/volumes      # K3s PVCs
```

**Server 3 (App Secondary — i7-8700, 3×1TB NVMe, HEL1):**

```bash
# SSD 1 (1TB NVMe) — OS + K3s + containers (already mounted at /)
mkdir -p /data/k3s

# SSD 2 (1TB NVMe) — K3s persistent volumes + staging data
mkfs.ext4 /dev/nvme1n1
mkdir -p /data/k3s-data
mount /dev/nvme1n1 /data/k3s-data
echo '/dev/nvme1n1 /data/k3s-data ext4 defaults,noatime 0 2' >> /etc/fstab

# SSD 3 (1TB NVMe) — MinIO object storage + backup mirror from Server 1
mkfs.ext4 /dev/nvme2n1
mkdir -p /data/extra
mount /dev/nvme2n1 /data/extra
echo '/dev/nvme2n1 /data/extra ext4 defaults,noatime 0 2' >> /etc/fstab

# Subdirectories on SSD 3
mkdir -p /data/extra/minio          # MinIO object storage
mkdir -p /data/extra/backup-sync    # DB backup mirror from Server 1
mkdir -p /data/extra/wal-sync       # WAL archive mirror

# Symlinks for convenience
ln -s /data/extra/minio /data/minio
ln -s /data/extra/backup-sync /data/backup-sync
```

**Server 4 (ML Node — Ryzen 9 5950X, 2×3.84TB Datacenter SSD, HEL1):**

```bash
# SSD 1 (3.84TB DC) — OS + K3s + containers (already mounted at /)
mkdir -p /data/k3s

# SSD 2 (3.84TB DC) — ML model cache + K3s PVCs
mkfs.ext4 /dev/sdb
mkdir -p /data/ml
mount /dev/sdb /data/ml
echo '/dev/sdb /data/ml ext4 defaults,noatime 0 2' >> /etc/fstab

# Subdirectories
mkdir -p /data/ml/models         # Pre-downloaded model weights (HuggingFace, PyTorch)
mkdir -p /data/ml/lora-adapters  # Per-learner LoRA adapter storage
mkdir -p /data/ml/volumes        # K3s PVCs for Python services
mkdir -p /data/ml/tmp            # Scratch space for training jobs
```

> **Storage Summary:**
> | Server | Total | Layout |
> |--------|-------|--------|
> | DB (W-2145) | **3.84TB** DC SSD | 1.92TB data + 1.92TB backups/WAL |
> | App1 (i9-9900K) | **2TB** NVMe | 1TB OS/K3s + 1TB PVCs/monitoring |
> | App2 (i7-8700) | **3TB** NVMe | 1TB OS/K3s + 1TB PVCs + **1TB MinIO/backups** |
> | ML (5950X) | **7.68TB** DC SSD | 3.84TB OS/K3s + **3.84TB model cache/LoRA/PVCs** |

---

## Phase 2: Database Setup (Server 1)

### 2.1 Install PostgreSQL 15

```bash
# Install PostgreSQL 15
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
apt update
apt install -y postgresql-15 postgresql-client-15

# Stop default instance, reconfigure for /data/postgres
systemctl stop postgresql
pg_dropcluster 15 main
pg_createcluster 15 main -d /data/postgres -- --auth-local=peer --auth-host=scram-sha-256

# Configure PostgreSQL
cat > /etc/postgresql/15/main/conf.d/aivo.conf << 'EOF'
# Connection
listen_addresses = '10.0.0.1,127.0.0.1'
port = 5432
max_connections = 500

# Memory (optimized for 128GB RAM, ~32GB for PG)
shared_buffers = 32GB
effective_cache_size = 80GB
work_mem = 64MB
maintenance_work_mem = 2GB
huge_pages = try

# WAL
wal_level = replica
max_wal_senders = 5
wal_keep_size = 2GB
archive_mode = on
archive_command = 'cp %p /data/secondary/wal-archive/%f'

# Checkpoints
checkpoint_completion_target = 0.9
max_wal_size = 4GB
min_wal_size = 1GB

# Query Planning
random_page_cost = 1.1
effective_io_concurrency = 200

# Logging
log_min_duration_statement = 500
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0

# Autovacuum
autovacuum_max_workers = 4
autovacuum_vacuum_scale_factor = 0.05
autovacuum_analyze_scale_factor = 0.025
EOF

# Configure pg_hba.conf for private network access
cat >> /etc/postgresql/15/main/pg_hba.conf << 'EOF'
# AIVO K3s cluster access (vSwitch)
host all aivo_app 10.0.0.0/24 scram-sha-256
host replication replicator 10.0.0.0/24 scram-sha-256
EOF

# Create WAL archive directory
mkdir -p /data/secondary/wal-archive
chown postgres:postgres /data/secondary/wal-archive

# Start PostgreSQL
systemctl start postgresql
systemctl enable postgresql
```

### 2.2 Create AIVO Databases and Users

```bash
sudo -u postgres psql << 'EOSQL'
-- Application user
CREATE USER aivo_app WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';

-- Create all per-service databases (AIVO v2 — 9 services)
CREATE DATABASE aivo_identity OWNER aivo_app;
CREATE DATABASE aivo_billing OWNER aivo_app;
CREATE DATABASE aivo_family OWNER aivo_app;
CREATE DATABASE aivo_integrations OWNER aivo_app;
CREATE DATABASE aivo_admin OWNER aivo_app;
CREATE DATABASE aivo_learning OWNER aivo_app;
CREATE DATABASE aivo_engagement OWNER aivo_app;
CREATE DATABASE aivo_comms OWNER aivo_app;
CREATE DATABASE aivo_prod OWNER aivo_app;

-- Replication user
CREATE USER replicator WITH REPLICATION PASSWORD 'CHANGE_ME_REPL_PASSWORD';

-- Grant extensions
\c aivo_identity
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Repeat for each database as needed
EOSQL
```

### 2.3 Install PgBouncer (Connection Pooling)

```bash
apt install -y pgbouncer

cat > /etc/pgbouncer/pgbouncer.ini << 'EOF'
[databases]
* = host=127.0.0.1 port=5432

[pgbouncer]
listen_addr = 10.0.0.1
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3
server_lifetime = 3600
server_idle_timeout = 600
log_connections = 0
log_disconnections = 0
log_pooler_errors = 1
stats_period = 60
EOF

# Generate userlist (hash passwords)
cat > /etc/pgbouncer/userlist.txt << 'EOF'
"aivo_app" "CHANGE_ME_STRONG_PASSWORD"
EOF

systemctl restart pgbouncer
systemctl enable pgbouncer
```

### 2.4 Install Redis 7

```bash
# Install Redis 7
curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/redis.list
apt update
apt install -y redis-server

# Configure Redis
cat > /etc/redis/redis.conf << 'EOF'
bind 10.0.0.1 127.0.0.1
port 6379
protected-mode yes
requirepass CHANGE_ME_REDIS_PASSWORD

# Memory
maxmemory 16gb
maxmemory-policy allkeys-lru

# Persistence
dir /data/secondary/redis
dbfilename dump.rdb
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec

# Performance
tcp-backlog 511
timeout 300
tcp-keepalive 300
io-threads 4
io-threads-do-reads yes

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log
EOF

chown -R redis:redis /data/secondary/redis
systemctl restart redis-server
systemctl enable redis-server

# Verify
redis-cli -a CHANGE_ME_REDIS_PASSWORD ping
```

### 2.5 Database Firewall (Server 1)

```bash
# Allow PostgreSQL + PgBouncer + Redis only from private network
ufw allow from 10.0.0.0/24 to any port 5432 comment 'PostgreSQL'
ufw allow from 10.0.0.0/24 to any port 6432 comment 'PgBouncer'
ufw allow from 10.0.0.0/24 to any port 6379 comment 'Redis'

# Allow K3s traffic from app servers (over vSwitch)
ufw allow from 10.0.0.0/24 to any port 6443 comment 'K3s API'
ufw allow from 10.0.0.0/24 to any port 10250 comment 'Kubelet'
```

### 2.6 Automated Backups

```bash
cat > /usr/local/bin/aivo-backup.sh << 'SCRIPT'
#!/bin/bash
set -euo pipefail
BACKUP_DIR="/data/backups/daily"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# Dump all databases (AIVO v2)
for DB in aivo_identity aivo_billing aivo_family aivo_integrations \
          aivo_admin aivo_learning aivo_engagement \
          aivo_comms aivo_prod; do
    pg_dump -U postgres -Fc "$DB" > "$BACKUP_DIR/${DB}_${DATE}.dump"
done

# Compress Redis snapshot
cp /data/redis/dump.rdb "$BACKUP_DIR/redis_${DATE}.rdb"

# Sync to Server 3 (i7-8700) via vSwitch (<1ms, same campus)
# Backups land on Server 3's dedicated 3rd SSD (1TB)
rsync -az --delete "$BACKUP_DIR/" deploy@10.0.0.3:/data/extra/backup-sync/db/
rsync -az /data/secondary/wal-archive/ deploy@10.0.0.3:/data/extra/wal-sync/

# Prune LOCAL backups older than 30 days (plenty of space on 1.92TB DC SSD)
find "$BACKUP_DIR" -type f -mtime +30 -delete
find /data/secondary/wal-archive -type f -mtime +14 -delete

# Prune REMOTE backups older than 90 days
ssh deploy@10.0.0.3 'find /data/extra/backup-sync -type f -mtime +90 -delete'

echo "[$(date)] Backup completed: $BACKUP_DIR → Server 3"
SCRIPT

chmod +x /usr/local/bin/aivo-backup.sh

# Schedule daily at 3 AM
echo "0 3 * * * root /usr/local/bin/aivo-backup.sh >> /var/log/aivo-backup.log 2>&1" > /etc/cron.d/aivo-backup
```

---

## Phase 3: K3s Cluster Setup

### 3.1 Install K3s Server (Server 2 — App Primary)

```bash
# Install K3s server
# NOTE: flannel uses the vSwitch VLAN interface for private cluster traffic
curl -sfL https://get.k3s.io | sh -s - server \
  --node-ip=10.0.0.2 \
  --advertise-address=10.0.0.2 \
  --flannel-iface=enp0s31f6.4000 \
  --tls-san=10.0.0.2 \
  --tls-san=aivo-app1 \
  --disable=traefik \
  --disable=servicelb \
  --data-dir=/data/k3s \
  --write-kubeconfig-mode=644 \
  --kube-apiserver-arg="--default-not-ready-toleration-seconds=30" \
  --kube-apiserver-arg="--default-unreachable-toleration-seconds=30"

# Wait for K3s to start
systemctl status k3s

# Get node token for joining agents
cat /var/lib/rancher/k3s/server/node-token

# Verify cluster
kubectl get nodes
```

### 3.2 Join K3s Agents (Server 1, Server 3, & Server 4)

**Server 1 (Database — light agent):**

```bash
# Get the token from Server 2
K3S_TOKEN="PASTE_TOKEN_FROM_SERVER_2"

curl -sfL https://get.k3s.io | K3S_URL=https://10.0.0.2:6443 K3S_TOKEN=$K3S_TOKEN sh -s - agent \
  --node-ip=10.0.0.1 \
  --flannel-iface=enp0s31f6.4000 \
  --node-label="role=database" \
  --node-taint="role=database:NoSchedule"
```

**Server 3 (App Secondary):**

```bash
curl -sfL https://get.k3s.io | K3S_URL=https://10.0.0.2:6443 K3S_TOKEN=$K3S_TOKEN sh -s - agent \
  --node-ip=10.0.0.3 \
  --flannel-iface=enp0s31f6.4000 \
  --data-dir=/data/k3s \
  --node-label="role=app"
```

**Server 4 (ML Node — Ryzen 9 5950X):**

```bash
curl -sfL https://get.k3s.io | K3S_URL=https://10.0.0.2:6443 K3S_TOKEN=$K3S_TOKEN sh -s - agent \
  --node-ip=10.0.0.4 \
  --flannel-iface=enp0s31f6.4000 \
  --data-dir=/data/k3s \
  --node-label="role=ml"
```

### 3.3 Verify Cluster

```bash
# On Server 2
kubectl get nodes -o wide
# Should show:
# aivo-app1   Ready    control-plane   10.0.0.2
# aivo-db1    Ready    <none>          10.0.0.1   (tainted: role=database)
# aivo-app2   Ready    <none>          10.0.0.3
# aivo-ml1    Ready    <none>          10.0.0.4

# Label app nodes
kubectl label node aivo-app1 role=app
```

### 3.4 Install Ingress NGINX

```bash
# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.5/deploy/static/provider/baremetal/deploy.yaml

# Patch to use host network (bare metal — binds to ports 80/443 on app nodes)
kubectl -n ingress-nginx patch deployment ingress-nginx-controller \
  --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/hostNetwork","value":true},
       {"op":"replace","path":"/spec/template/spec/containers/0/ports/0/containerPort","value":80},
       {"op":"replace","path":"/spec/template/spec/containers/0/ports/1/containerPort","value":443}]'

# Ensure it runs on app nodes only
kubectl -n ingress-nginx patch deployment ingress-nginx-controller \
  --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/tolerations","value":[]},
       {"op":"add","path":"/spec/template/spec/nodeSelector","value":{"role":"app"}}]'
```

### 3.5 Install cert-manager (Let's Encrypt)

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.4/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=Available deployment --all -n cert-manager --timeout=120s

# Create Let's Encrypt issuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@aivo.ai
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

---

## Phase 4: Container Registry

### 4.1 Install Harbor (Self-hosted Registry) on Server 2

```bash
# Download Harbor
cd /tmp
wget https://github.com/goharbor/harbor/releases/download/v2.10.0/harbor-online-installer-v2.10.0.tgz
tar xzf harbor-online-installer-v2.10.0.tgz
cd harbor

# Configure harbor.yml
cat > harbor.yml << 'EOF'
hostname: registry.internal.aivo.ai
http:
  port: 5000
harbor_admin_password: CHANGE_ME_HARBOR_ADMIN
database:
  password: CHANGE_ME_HARBOR_DB
  max_idle_conns: 50
  max_open_conns: 100
data_volume: /data/k3s/harbor
storage_service:
  filesystem:
    maxthreads: 100
log:
  level: info
  local:
    location: /var/log/harbor
EOF

./install.sh --with-trivy

# Configure K3s to use private registry
cat > /etc/rancher/k3s/registries.yaml << 'EOF'
mirrors:
  "registry.internal.aivo.ai:5000":
    endpoint:
      - "http://10.0.0.2:5000"
configs:
  "10.0.0.2:5000":
    auth:
      username: admin
      password: CHANGE_ME_HARBOR_ADMIN
EOF

# Restart K3s to pick up registry config
systemctl restart k3s
```

**Alternative (simpler):** Use GitHub Container Registry (ghcr.io) instead of self-hosting Harbor. Just update the image references:

```bash
# In your CI/CD, push to ghcr.io instead of gcr.io:
# ghcr.io/artpromedia/aivo-identity-svc:v1.0.0
```

---

## Phase 5: Deploy AIVO Services

### 5.1 Create Namespaces and Secrets

```bash
# Create namespaces
kubectl create namespace aivo
kubectl create namespace aivo-staging
kubectl create namespace aivo-monitoring

# Create secrets (replace ALL placeholders with real values)
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: shared-secrets
  namespace: aivo
type: Opaque
stringData:
  # Database — point to PgBouncer on Server 1
  postgres-host: "10.0.0.1"
  postgres-port: "6432"
  postgres-user: "aivo_app"
  postgres-password: "CHANGE_ME_STRONG_PASSWORD"

  # Redis — Server 1
  redis-url: "redis://:CHANGE_ME_REDIS_PASSWORD@10.0.0.1:6379"

  # NATS (optional — if you install NATS later)
  nats-url: ""
---
apiVersion: v1
kind: Secret
metadata:
  name: identity-svc-secrets
  namespace: aivo
type: Opaque
stringData:
  database-url: "postgresql://aivo_app:CHANGE_ME_STRONG_PASSWORD@10.0.0.1:6432/aivo_identity?schema=public"
  jwt-private-key: "PASTE_YOUR_RSA_PRIVATE_KEY"
  jwt-public-key: "PASTE_YOUR_RSA_PUBLIC_KEY"
  sso-state-encryption-key: "GENERATE_32_BYTE_HEX"
  mfa-encryption-key: "GENERATE_32_BYTE_HEX"
---
apiVersion: v1
kind: Secret
metadata:
  name: ai-svc-secrets
  namespace: aivo
type: Opaque
stringData:
  google-gemini-api-key: "YOUR_GEMINI_KEY"
  google-project-id: "your-gcp-project"
  openai-api-key: "YOUR_OPENAI_KEY"
  openai-organization-id: "YOUR_OPENAI_ORG"
  anthropic-api-key: "YOUR_ANTHROPIC_KEY"
  internal-api-key: "GENERATE_RANDOM_KEY"
---
apiVersion: v1
kind: Secret
metadata:
  name: billing-svc-secrets
  namespace: aivo
type: Opaque
stringData:
  database-url: "postgresql://aivo_app:CHANGE_ME_STRONG_PASSWORD@10.0.0.1:6432/aivo_billing?schema=public"
  jwt-secret: "GENERATE_RANDOM_KEY"
  stripe-secret-key: "sk_live_YOUR_STRIPE_KEY"
  stripe-publishable-key: "pk_live_YOUR_STRIPE_KEY"
  stripe-webhook-secret: "whsec_YOUR_WEBHOOK_SECRET"
---
apiVersion: v1
kind: Secret
metadata:
  name: comms-svc-secrets
  namespace: aivo
type: Opaque
stringData:
  database-url: "postgresql://aivo_app:CHANGE_ME_STRONG_PASSWORD@10.0.0.1:6432/aivo_comms?schema=public"
  sendgrid-api-key: "YOUR_SENDGRID_KEY"
  twilio-account-sid: "YOUR_TWILIO_SID"
  twilio-auth-token: "YOUR_TWILIO_TOKEN"
  firebase-private-key: "YOUR_FIREBASE_KEY"
  firebase-client-email: "YOUR_FIREBASE_EMAIL"
  firebase-project-id: "YOUR_FIREBASE_PROJECT"
  apns-key-id: "YOUR_APNS_KEY_ID"
  apns-team-id: "YOUR_APNS_TEAM_ID"
  apns-private-key: "YOUR_APNS_PRIVATE_KEY"
EOF
```

### 5.2 Create Kustomize Overlay for Hetzner (Reference)

> **Note:** v2 uses Helm for deployment (`infra/helm/`). This Kustomize overlay
> is kept as a reference for resource patches; production deploys use
> `helm upgrade --install aivo-platform infra/helm/ -f infra/helm/values/hetzner.yaml`.

```bash
mkdir -p infra/k8s/overlays/hetzner
```

```yaml
# infra/k8s/overlays/hetzner/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: aivo

resources:
  - ../../base

commonLabels:
  environment: production
  platform: hetzner

images:
  # AIVO v2 services (9 services)
  - name: aivo/identity-svc
    newName: ghcr.io/artpromedia/aivo-identity-svc
    newTag: latest
  - name: aivo/billing-svc
    newName: ghcr.io/artpromedia/aivo-billing-svc
    newTag: latest
  - name: aivo/family-svc
    newName: ghcr.io/artpromedia/aivo-family-svc
    newTag: latest
  - name: aivo/integrations-svc
    newName: ghcr.io/artpromedia/aivo-integrations-svc
    newTag: latest
  - name: aivo/admin-svc
    newName: ghcr.io/artpromedia/aivo-admin-svc
    newTag: latest
  - name: aivo/ai-svc
    newName: ghcr.io/artpromedia/aivo-ai-svc
    newTag: latest
  - name: aivo/learning-svc
    newName: ghcr.io/artpromedia/aivo-learning-svc
    newTag: latest
  - name: aivo/engagement-svc
    newName: ghcr.io/artpromedia/aivo-engagement-svc
    newTag: latest
  - name: aivo/comms-svc
    newName: ghcr.io/artpromedia/aivo-comms-svc
    newTag: latest

patches:
  # Set all services to 1 replica initially (scale up later)
  - target:
      kind: Deployment
    patch: |
      - op: replace
        path: /spec/replicas
        value: 1
  # Resource limits for Hetzner
  - target:
      kind: Deployment
    patch: |
      - op: replace
        path: /spec/template/spec/containers/0/resources
        value:
          requests:
            cpu: 50m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
  # AI Orchestrator gets more resources
  - target:
      kind: Deployment
      name: ai-svc
    patch: |
      - op: replace
        path: /spec/template/spec/containers/0/resources
        value:
          requests:
            cpu: 200m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 2Gi

### 5.3 Create AIVO Ingress for Hetzner

```yaml
# infra/k8s/overlays/hetzner/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: aivo-api-ingress
  namespace: aivo
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: '50m'
    nginx.ingress.kubernetes.io/rate-limit: '100'
    nginx.ingress.kubernetes.io/rate-limit-window: '1m'
    nginx.ingress.kubernetes.io/ssl-redirect: 'true'
    nginx.ingress.kubernetes.io/use-forwarded-headers: 'true'
    nginx.ingress.kubernetes.io/proxy-read-timeout: '60'
    nginx.ingress.kubernetes.io/proxy-send-timeout: '60'
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.aivo.ai
      secretName: aivo-api-tls
  rules:
    - host: api.aivo.ai
      http:
        paths:
          - path: /api/v1/auth
            pathType: Prefix
            backend:
              service:
                name: identity-svc
                port:
                  number: 3000
          - path: /api/v1/learning
            pathType: Prefix
            backend:
              service:
                name: learning-svc
                port:
                  number: 3000
          - path: /api/v1/ai
            pathType: Prefix
            backend:
              service:
                name: ai-svc
                port:
                  number: 8000
          - path: /api/v1/engagement
            pathType: Prefix
            backend:
              service:
                name: engagement-svc
                port:
                  number: 3000
          - path: /api/v1/comms
            pathType: Prefix
            backend:
              service:
                name: comms-svc
                port:
                  number: 3000
          - path: /api/v1/billing
            pathType: Prefix
            backend:
              service:
                name: billing-svc
                port:
                  number: 3000
          - path: /api/v1/family
            pathType: Prefix
            backend:
              service:
                name: family-svc
                port:
                  number: 3000
          - path: /api/v1/admin
            pathType: Prefix
            backend:
              service:
                name: admin-svc
                port:
                  number: 3000
          - path: /api/v1/integrations
            pathType: Prefix
            backend:
              service:
                name: integrations-svc
                port:
                  number: 3000
          - path: /health
            pathType: Exact
            backend:
              service:
                name: identity-svc
                port:
                  number: 3000
```

### 5.4 Run Database Migrations

```bash
# From your development machine, run migrations against Hetzner PostgreSQL
# (Ensure SSH tunnel or direct access to 10.0.0.1:5432)

# SSH tunnel
ssh -L 5432:10.0.0.1:5432 deploy@SERVER2_PUBLIC_IP

# Then in separate terminal, for each service with Prisma:
cd services/identity-svc
DATABASE_URL="postgresql://aivo_app:PASSWORD@localhost:5432/aivo_identity?schema=public" npx prisma migrate deploy

cd ../learning-svc
DATABASE_URL="postgresql://aivo_app:PASSWORD@localhost:5432/aivo_learning?schema=public" npx prisma migrate deploy

cd ../billing-svc
DATABASE_URL="postgresql://aivo_app:PASSWORD@localhost:5432/aivo_billing?schema=public" npx prisma migrate deploy

# Repeat for all 9 v2 services with prisma/schema.prisma
````

### 5.5 Deploy Services

```bash
# On Server 2 (K3s server)

# Deploy via Helm
helm upgrade --install aivo-platform infra/helm/ \
  -f infra/helm/values/hetzner.yaml \
  --namespace aivo \
  --create-namespace \
  --atomic --wait --timeout 5m

# Watch rollout
kubectl -n aivo rollout status deployment --timeout=300s

# Check all pods
kubectl -n aivo get pods -o wide

# Check services
kubectl -n aivo get svc
```

---

## Phase 6: Monitoring Stack

### 6.1 Deploy Observability (Server 2)

```bash
# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Add repos
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Prometheus + Grafana stack
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace aivo-monitoring \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi \
  --set grafana.persistence.enabled=true \
  --set grafana.persistence.size=10Gi \
  --set grafana.adminPassword=CHANGE_ME_GRAFANA \
  --set alertmanager.alertmanagerSpec.storage.volumeClaimTemplate.spec.resources.requests.storage=5Gi

# Install Loki for logs
helm install loki grafana/loki-stack \
  --namespace aivo-monitoring \
  --set loki.persistence.enabled=true \
  --set loki.persistence.size=50Gi \
  --set promtail.enabled=true
```

---

## Phase 7: Cloudflare Setup (CDN + WAF + DNS)

### 7.1 DNS Records

In Cloudflare dashboard, point your domain to **Server 2's public IP** (i9-9900K, HEL1, Helsinki):

| Type | Name        | Value              | Proxy      |
| ---- | ----------- | ------------------ | ---------- |
| A    | api.aivo.ai | SERVER_2_PUBLIC_IP | ✅ Proxied |
| A    | app.aivo.ai | SERVER_2_PUBLIC_IP | ✅ Proxied |
| A    | aivo.ai     | SERVER_2_PUBLIC_IP | ✅ Proxied |

### 7.2 Cloudflare Settings

- **SSL/TLS:** Full (strict) — Cloudflare ↔ Hetzner encrypted
- **WAF:** Enable OWASP ruleset
- **Rate Limiting:** 1000 requests/min per IP
- **Caching:** Cache static assets, bypass API paths
- **Firewall Rules:**
  - Block known bot user agents
  - Challenge suspicious IPs
  - Allow Stripe/SendGrid webhook IPs

### 7.3 Server Firewall (Cloudflare Only)

On Servers 2 (i9-9900K) and 3 (i7-8700) — both HEL1, restrict HTTP/HTTPS to Cloudflare IPs only:

> **Note:** Server 4 (ML Node) does NOT need Cloudflare firewall rules — Python
> ML services are accessed only via K3s internal networking (ClusterIP). Its
> firewall should allow only SSH (22), K3s (6443/10250), and vSwitch (10.0.0.0/24).

```bash
# Download Cloudflare IP ranges
for ip in $(curl -s https://www.cloudflare.com/ips-v4); do
    ufw allow from $ip to any port 80 comment 'Cloudflare'
    ufw allow from $ip to any port 443 comment 'Cloudflare'
done

# Block direct access from all other IPs
ufw deny 80/tcp
ufw deny 443/tcp
```

---

## Phase 8: CI/CD Pipeline (GitHub Actions)

### 8.1 New Deployment Workflow

Create `.github/workflows/deploy-hetzner.yml`:

```yaml
name: Deploy to Hetzner

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to deploy'
        required: true

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ghcr.io/artpromedia

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    strategy:
      matrix:
        service:
          - identity-svc
          - billing-svc
          - family-svc
          - integrations-svc
          - admin-svc
          - ai-svc
          - learning-svc
          - engagement-svc
          - comms-svc
          - web
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: services/${{ matrix.service }}
          file: services/${{ matrix.service }}/Dockerfile
          push: true
          tags: |
            ${{ env.IMAGE_PREFIX }}/aivo-${{ matrix.service }}:${{ github.sha }}
            ${{ env.IMAGE_PREFIX }}/aivo-${{ matrix.service }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Hetzner via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.HETZNER_APP1_IP }}
          username: deploy
          key: ${{ secrets.HETZNER_SSH_KEY }}
          script: |
            cd /opt/aivo
            git pull origin main

            # Update image tags via Helm (replaces old Kustomize approach)
            helm upgrade --install aivo-platform ./infra/helm \
              -f infra/helm/values/hetzner.yaml \
              -n aivo \
              --set global.image.tag=${{ github.sha }} \
              --atomic --wait --timeout 5m

            # Verify rollout
            kubectl -n aivo rollout status deployment --timeout=300s

            # Health check
            kubectl -n aivo get pods
```

### 8.2 GitHub Secrets to Configure

| Secret            | Value                             |
| ----------------- | --------------------------------- |
| `HETZNER_APP1_IP` | Server 2 public IP                |
| `HETZNER_SSH_KEY` | SSH private key for `deploy` user |

---

## Phase 9: MinIO for S3-Compatible Object Storage

MinIO runs on **Server 3 (i7-8700)** which has a dedicated 3rd SSD (1TB) for object storage.
For user-facing assets, use **Cloudflare R2** (see Phase 11.4) — MinIO handles internal storage.

### 9.1 Install MinIO on Server 3

```bash
# Install MinIO
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
mv minio /usr/local/bin/

# Create systemd service
cat > /etc/systemd/system/minio.service << 'EOF'
[Unit]
Description=MinIO Object Storage
After=network.target

[Service]
User=deploy
Group=deploy
ExecStart=/usr/local/bin/minio server /data/extra/minio --console-address ":9001" --address ":9000"
Environment="MINIO_ROOT_USER=aivo-admin"
Environment="MINIO_ROOT_PASSWORD=CHANGE_ME_MINIO_PASSWORD"
Restart=always
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl start minio
systemctl enable minio

# Install mc (MinIO client)
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
mv mc /usr/local/bin/

# Configure and create buckets
mc alias set aivo http://10.0.0.3:9000 aivo-admin CHANGE_ME_MINIO_PASSWORD
mc mb aivo/content-assets
mc mb aivo/user-uploads
mc mb aivo/backups
mc mb aivo/exports
mc mb aivo/static-assets
mc mb aivo/ml-models
mc mb aivo/research-data
```

> **Storage budget:** 1TB NVMe (3rd SSD on Server 3) dedicated to MinIO.
> For user-facing assets (images, videos, uploads), use **Cloudflare R2** (Phase 11.4)
> — zero egress fees and served from 300+ edge locations worldwide.

---

## Phase 10: Web App Deployment

### 10.1 Build and Serve Web Apps

AIVO has 10 Next.js web apps. On Hetzner, serve them via nginx or as Docker containers:

```bash
# Option 1: Static export + NGINX (simplest)
# Build each web app
cd apps/web-learner && pnpm build && pnpm export
cd apps/web-parent && pnpm build && pnpm export
# etc.

# Option 2: Containerize and deploy to K3s
# Each app gets its own Deployment + Service + Ingress rule
```

Cloudflare handles caching of static assets automatically.

---

## Phase 11: US Performance Optimization

With servers hosted in EU (Hetzner HEL1/FSN1), US users experience ~85-170ms latency to the origin.
This phase eliminates that penalty for 90%+ of requests using Cloudflare's edge network.

### 11.1 Latency Baseline (Without Optimization)

| Route                           | Raw Latency | Impact                  |
| ------------------------------- | ----------- | ----------------------- |
| EU → US East Coast              | ~85-95ms    | Noticeable on API calls |
| EU → US West Coast              | ~150-170ms  | Sluggish for real-time  |
| EU → US (cached via Cloudflare) | ~10-20ms    | Imperceptible ✅        |

### 11.2 Cloudflare Argo Smart Routing (~$5/mo)

Argo routes traffic through Cloudflare's **private backbone** instead of the public internet,
cutting EU→US latency by ~30-35%.

```
Cloudflare Dashboard → your domain → Speed → Optimization:

1. Argo Smart Routing: ON
   → Routes via Cloudflare private backbone
   → US East: 90ms → ~60ms
   → US West: 170ms → ~110ms
   → Cost: ~$5/mo + $0.10/GB (typically <$10/mo total)

2. Tiered Caching: ON (free)
   → US edge nodes cache from regional tier, not origin
   → Reduces origin hits by ~50%

3. Early Hints: ON (free)
   → Preloads CSS/JS while browser waits for HTML response

4. HTTP/3 (QUIC): ON (free, under Network tab)
   → Faster initial connections, especially on mobile
   → Eliminates TCP head-of-line blocking

5. 0-RTT Connection Resumption: ON (free)
   → Returning US users connect with zero round-trip overhead
```

### 11.3 Cloudflare Cache Rules (Free)

Cache read-heavy API responses at the edge so US users get instant responses:

```
Cloudflare Dashboard → Caching → Cache Rules:

Rule 1: "Content API Cache"
  When: URI Path starts with "/api/v1/content"
  And: Request Method equals "GET"
  Then: Cache (Edge TTL: 1 hour, Browser TTL: 5 min)

Rule 2: "Life Skills Cache"
  When: URI Path starts with "/api/v1/life-skills"
  And: Request Method equals "GET"
  Then: Cache (Edge TTL: 30 min)

Rule 3: "Baseline Cache"
  When: URI Path starts with "/api/v1/baseline"
  And: Request Method equals "GET"
  Then: Cache (Edge TTL: 1 hour)

Rule 4: "Personalization Cache"
  When: URI Path starts with "/api/v1/personalization"
  And: Request Method equals "GET"
  Then: Cache (Edge TTL: 15 min)

Rule 5: "Bypass Auth/Write APIs"
  When: URI Path starts with "/api/v1/auth"
  Or: URI Path starts with "/api/v1/sessions"
  Or: URI Path starts with "/api/v1/billing"
  Or: URI Path starts with "/api/v1/payments"
  Or: Request Method is not "GET"
  Then: Bypass Cache
```

**Also add cache headers in your NestJS services:**

```typescript
// In read-heavy controllers (learning-svc)
@Get(':id')
@Header('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')
async findOne(@Param('id') id: string) {
  // s-maxage=3600 → Cloudflare edge caches for 1 hour
  // stale-while-revalidate → Serve stale while refreshing in background
  return this.service.findOne(id);
}
```

### 11.4 Cloudflare R2 — Replace MinIO for User-Facing Assets

R2 is S3-compatible object storage served from Cloudflare's edge — **zero egress fees**
and instant delivery worldwide. Use it for user-facing content while keeping MinIO for
internal/backup storage.

```
Cloudflare Dashboard → R2 → Create Bucket:

Bucket 1: "aivo-content-assets"
  → Lesson images, videos, audio files
  → Custom domain: assets.aivo.ai (proxied)

Bucket 2: "aivo-user-uploads"
  → Profile photos, submitted work
  → Custom domain: uploads.aivo.ai (proxied)

Bucket 3: "aivo-static"
  → Next.js static exports, fonts, icons
  → Custom domain: static.aivo.ai (proxied)
```

**R2 Pricing vs MinIO:**

|                  | MinIO (Hetzner)         | Cloudflare R2 |
| ---------------- | ----------------------- | ------------- |
| **US Latency**   | 85-170ms                | **~10ms** ✅  |
| **Storage**      | Free (on-disk)          | $0.015/GB/mo  |
| **Egress**       | Free (Hetzner)          | **Free** ✅   |
| **100GB stored** | $0                      | ~$1.50/mo     |
| **S3 API**       | ✅                      | ✅            |
| **Global CDN**   | ❌ (must go through CF) | ✅ Built-in   |

**Configure services to use R2 for user-facing, MinIO for internal:**

```bash
# K8s secrets for R2
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: r2-secrets
  namespace: aivo
type: Opaque
stringData:
  r2-account-id: "YOUR_CF_ACCOUNT_ID"
  r2-access-key-id: "YOUR_R2_ACCESS_KEY"
  r2-secret-access-key: "YOUR_R2_SECRET_KEY"
  r2-endpoint: "https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com"
  r2-public-url: "https://assets.aivo.ai"
  # MinIO on Server 3 (i7-8700, 3rd SSD) for internal use
  minio-endpoint: "http://10.0.0.3:9000"
  minio-access-key: "aivo-admin"
  minio-secret-key: "CHANGE_ME_MINIO_PASSWORD"
EOF
```

### 11.5 Cloudflare Workers — Edge Compute (~$5/mo)

Run logic at 300+ edge locations worldwide. Use for JWT validation, session lookups,
and API response caching — so US users never wait for the EU round-trip on common operations.

```javascript
// workers/aivo-edge.js
// Deploy via: wrangler deploy

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Static content APIs — edge cache with stale-while-revalidate
    if (url.pathname.startsWith('/api/v1/content/') && request.method === 'GET') {
      const cache = caches.default;
      const cacheKey = new Request(url.toString(), request);
      let response = await cache.match(cacheKey);

      if (response) {
        // Cache HIT — served from nearest US edge node (~10ms)
        response = new Response(response.body, response);
        response.headers.set('X-Cache', 'HIT');
        return response;
      }

      // Cache MISS — fetch from EU origin
      response = await fetch(request);
      if (response.ok) {
        response = new Response(response.body, response);
        response.headers.set('Cache-Control', 'public, s-maxage=3600');
        response.headers.set('X-Cache', 'MISS');
        await cache.put(cacheKey, response.clone());
      }
      return response;
    }

    // 2. JWT pre-validation at edge (reject bad tokens instantly)
    if (url.pathname.startsWith('/api/v1/') && request.method !== 'GET') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Missing authorization' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Basic JWT structure validation (reject malformed tokens at edge)
      const token = authHeader.substring(7);
      const parts = token.split('.');
      if (parts.length !== 3) {
        return new Response(JSON.stringify({ error: 'Invalid token format' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Check expiry at edge (avoid round-trip for expired tokens)
      try {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
          return new Response(JSON.stringify({ error: 'Token expired' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch (e) {
        // Let origin handle malformed payloads
      }
    }

    // 3. Add geo headers for origin
    const newRequest = new Request(request);
    newRequest.headers.set('X-Client-Country', request.cf?.country || 'unknown');
    newRequest.headers.set('X-Client-Region', request.cf?.region || 'unknown');
    newRequest.headers.set('X-Client-City', request.cf?.city || 'unknown');

    return fetch(newRequest);
  },
};
```

**Deploy with Wrangler:**

```bash
# Install Wrangler CLI
npm install -g wrangler

# wrangler.toml
cat > wrangler.toml << 'EOF'
name = "aivo-edge"
main = "workers/aivo-edge.js"
compatibility_date = "2024-01-01"

[triggers]
routes = [
  { pattern = "api.aivo.ai/api/v1/*", zone_name = "aivo.ai" }
]
EOF

wrangler deploy
```

**Workers Pricing:**
| Tier | Requests | Cost |
|------|----------|------|
| Free | 100K/day | $0 |
| Paid | 10M/mo included | $5/mo |
| Overage | Per 1M additional | $0.50 |

### 11.6 Cloudflare KV — Session Reads at Edge (~$5/mo)

Store session tokens in Cloudflare KV so US session validation is instant (~5ms)
instead of hitting Redis in EU (~90ms).

```javascript
// In your identity-svc, after creating a session:
// Write to both Redis (EU) and Cloudflare KV (global edge)

// workers/session-sync.js — Syncs sessions to KV on creation
export default {
  async fetch(request, env) {
    const response = await fetch(request);

    // After successful login, cache the session token in KV
    if (
      request.method === 'POST' &&
      new URL(request.url).pathname === '/api/v1/auth/login' &&
      response.ok
    ) {
      const body = await response.clone().json();
      if (body.accessToken) {
        // Store in KV with same TTL as the JWT
        await env.SESSIONS.put(
          `session:${body.accessToken.substring(0, 32)}`,
          JSON.stringify({ userId: body.userId, role: body.role }),
          { expirationTtl: 3600 } // 1 hour
        );
      }
    }

    return response;
  },
};
```

### 11.7 Optional: Hetzner Cloud Ashburn Edge Proxy (~$40/mo)

For maximum US performance, add a lightweight Hetzner Cloud server in Ashburn, VA
as a caching reverse proxy with a Redis read replica:

```
US Users → Cloudflare (US edge, ~10ms)
                ↓
    Hetzner Cloud Ashburn CCX23 (~$40/mo)
    ├── Redis read replica (synced from EU Server 1)
    ├── NGINX reverse proxy with microcaching
    └── Cached API responses
                ↓ (only cache misses + writes)
    Hetzner Dedicated EU (HEL1/FSN1)
    └── PostgreSQL, full app stack
```

**Setup on Hetzner Cloud Ashburn (if needed later):**

```bash
# Order: Hetzner Cloud → Location: Ashburn → CCX23 (4 vCPU, 16GB, 160GB)
# Public IP assigned automatically

# Install Redis as read replica
apt install -y redis-server
cat >> /etc/redis/redis.conf << 'EOF'
replicaof EU_SERVER1_PUBLIC_IP 6379
masterauth CHANGE_ME_REDIS_PASSWORD
requirepass CHANGE_ME_REDIS_PASSWORD
maxmemory 8gb
maxmemory-policy allkeys-lru
EOF
systemctl restart redis-server

# Install NGINX with microcaching
apt install -y nginx
cat > /etc/nginx/sites-available/aivo-proxy << 'NGINX'
proxy_cache_path /var/cache/nginx/aivo levels=1:2 keys_zone=aivo:50m
                 max_size=5g inactive=60m use_temp_path=off;

upstream eu_origin {
    server EU_SERVER2_PUBLIC_IP:443;
    keepalive 32;
}

server {
    listen 80;
    server_name api-us.aivo.ai;

    # Microcache GET requests (1 second — eliminates thundering herd)
    location ~ ^/api/v1/(content|life-skills|baseline|personalization) {
        proxy_cache aivo;
        proxy_cache_valid 200 5m;
        proxy_cache_valid 404 1m;
        proxy_cache_use_stale error timeout updating;
        proxy_cache_background_update on;
        proxy_cache_lock on;
        add_header X-Cache-Status $upstream_cache_status;

        proxy_pass https://eu_origin;
        proxy_set_header Host api.aivo.ai;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_ssl_verify off;
    }

    # Pass-through for auth/write APIs
    location /api/ {
        proxy_pass https://eu_origin;
        proxy_set_header Host api.aivo.ai;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_ssl_verify off;
    }
}
NGINX

ln -s /etc/nginx/sites-available/aivo-proxy /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx
```

**Then add a Cloudflare DNS record:**
| Type | Name | Value | Proxy |
|------|------|-------|-------|
| A | api-us.aivo.ai | ASHBURN_SERVER_IP | ✅ Proxied |

**Cloudflare Load Balancing ($5/mo) can auto-route:**

- US users → api-us.aivo.ai (Ashburn proxy)
- EU users → api.aivo.ai (direct to Hetzner EU)

### 11.8 US Optimization Summary

| Phase    | What                        | Cost        | US Latency Result             |
| -------- | --------------------------- | ----------- | ----------------------------- |
| **11.2** | Argo Smart Routing          | ~$5/mo      | API: 90ms → **60ms**          |
| **11.3** | Cache Rules (read APIs)     | Free        | Reads: 90ms → **10ms**        |
| **11.4** | R2 for assets               | ~$2/mo      | Files: 90ms → **10ms**        |
| **11.5** | Workers (JWT + cache)       | ~$5/mo      | Auth reject: 90ms → **5ms**   |
| **11.6** | KV for sessions             | ~$5/mo      | Session reads: 90ms → **5ms** |
| **11.7** | Ashburn proxy (optional)    | ~$40/mo     | All reads: 90ms → **15ms**    |
|          | **Total (without Ashburn)** | **~$17/mo** | **90%+ requests <20ms**       |
|          | **Total (with Ashburn)**    | **~$57/mo** | **95%+ requests <15ms**       |

> **Recommendation:** Start with Phases 11.2–11.4 at launch (~$7/mo). Add Workers
> and KV (11.5–11.6) when US user base grows. Only add the Ashburn proxy (11.7)
> if you have >1000 daily US users and need sub-20ms for everything.

---

## Quick Reference: Server IPs & Ports

### Private Network (vSwitch 10.0.0.0/24 — all HEL1)

| Server          | IP       | Location | CPU / RAM / Storage                                 | Cost         | Services                                                                      |
| --------------- | -------- | -------- | --------------------------------------------------- | ------------ | ----------------------------------------------------------------------------- |
| DB (Server 1)   | 10.0.0.1 | HEL1     | Xeon W-2145 8C/16T / 128GB ECC / 2×1.92TB DC SSD    | $81.90/mo    | PostgreSQL :5432, PgBouncer :6432, Redis :6379                                |
| App1 (Server 2) | 10.0.0.2 | HEL1     | i9-9900K 8C/16T / 128GB / 2×1TB NVMe                | $53.90/mo    | K3s control plane :6443, Ingress :80/:443, 9 TypeScript services, Monitoring |
| App2 (Server 3) | 10.0.0.3 | HEL1     | i7-8700 6C/12T / 128GB / 3×1TB NVMe                 | $51.90/mo    | K3s Agent, MinIO :9000, backup mirror, staging                                |
| ML (Server 4)   | 10.0.0.4 | HEL1     | Ryzen 9 5950X 16C/32T / 128GB ECC / 2×3.84TB DC SSD | ~$105/mo     | K3s Agent, 1 Python AI service (ai-svc), model cache                              |
|                 |          |          |                                                     | **~$293/mo** |                                                                               |

### Application Service Ports (inside K3s)

| Service             | Port | Health Check |
| ------------------- | ---- | ------------ |
| identity-svc        | 3000 | /health      |
| billing-svc         | 3000 | /health      |
| family-svc          | 3000 | /health      |
| integrations-svc    | 3000 | /health      |
| admin-svc           | 3000 | /health      |
| ai-svc              | 8000 | /health      |
| learning-svc        | 3000 | /health      |
| engagement-svc      | 3000 | /health      |
| comms-svc           | 3000 | /health      |
| web                 | 3000 | /            |

---

## Checklist

- [ ] **Phase 1:** OS installed, users created, firewalls configured, vSwitch connected (all HEL1)
- [ ] **Phase 2:** PostgreSQL running, all databases created, PgBouncer configured, Redis running, backups scheduled
- [ ] **Phase 3:** K3s cluster operational, Ingress NGINX installed, cert-manager ready
- [ ] **Phase 4:** Container registry configured (GHCR)
- [ ] **Phase 5a:** Secrets created (shared + identity + ai + billing + comms)
- [ ] **Phase 5b:** Helm chart deployed (**9 services + web = 10 workloads**)
- [ ] **Phase 5c:** Migrations run, all **10 services** deployed and healthy
- [ ] **Phase 6:** Prometheus + Grafana + Loki monitoring stack running
- [ ] **Phase 7:** Cloudflare DNS pointed, WAF enabled, SSL working
- [ ] **Phase 8:** GitHub Actions CI/CD deploying **10 services** to Hetzner on push to main
- [ ] **Phase 9:** MinIO running on Server 3 with buckets created (incl. `ml-models`)
- [ ] **Phase 10:** Web apps built and served
- [ ] **Phase 11:** Argo Smart Routing enabled, Cache Rules configured, R2 buckets created, Workers deployed (optional: Ashburn edge proxy)

---

## Estimated Timeline

| Phase                              | Duration      | Dependencies         |
| ---------------------------------- | ------------- | -------------------- |
| Phase 1: Server setup              | 2–4 hours     | Server access        |
| Phase 2: Database                  | 2–3 hours     | Phase 1              |
| Phase 3: K3s cluster               | 1–2 hours     | Phase 1              |
| Phase 4: Registry                  | 1 hour        | Phase 3              |
| Phase 5a: TypeScript services      | 3–4 hours     | Phases 2, 3, 4       |
| Phase 5b: Python ML services       | 2–3 hours     | Phase 5a             |
| Phase 5c: Node labels + ML ingress | 30 min        | Phase 3              |
| Phase 6: Monitoring                | 1 hour        | Phase 3              |
| Phase 7: Cloudflare                | 30 min        | Phase 3              |
| Phase 8: CI/CD                     | 1–2 hours     | Phases 4, 5          |
| Phase 9: MinIO                     | 30 min        | Phase 1              |
| Phase 10: Web apps                 | 1–2 hours     | Phase 3              |
| Phase 11: US optimization          | 1–2 hours     | Phase 7 (Cloudflare) |
| **Total**                          | **~2.5 days** |                      |

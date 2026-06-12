#!/usr/bin/env bash
# One-time: let the github-runner user execute the ROOT-OWNED distribute
# script (and nothing else) so deploy-hetzner's "Build & Roll Out web-v2"
# job can import images into k3s containerd. Run ON aivo-app1 as root.
set -euo pipefail

# 1. Pin the root-owned copy (runner must NOT be able to edit what it sudoes).
chown root:root /opt/aivo-deploy/distribute-one.sh
chmod 755 /opt/aivo-deploy/distribute-one.sh

# 2. Narrow sudoers drop-in.
cat > /etc/sudoers.d/github-runner-distribute <<'EOF'
# deploy-hetzner web-v2 job: import locally-built images into k3s containerd.
# Script is root-owned 755 in /opt/aivo-deploy (runner-unwritable).
github-runner ALL=(root) NOPASSWD: /opt/aivo-deploy/distribute-one.sh
EOF
chmod 0440 /etc/sudoers.d/github-runner-distribute
visudo -c

# 3. Prove it works as the runner user.
su -s /bin/bash github-runner -c "sudo -n /opt/aivo-deploy/distribute-one.sh 2>&1 | head -1" || true
echo "Expect the usage line above (usage: distribute-one.sh TAG REPO) — that means sudo works."

#!/bin/bash
# Runs on aivo-app1; orchestrates CF range fetch + push to app2.
set -euo pipefail

echo "=== fetching Cloudflare IP ranges ==="
curl -fsS https://www.cloudflare.com/ips-v4 > /tmp/cf-v4.txt
curl -fsS https://www.cloudflare.com/ips-v6 > /tmp/cf-v6.txt
echo "v4: $(wc -l < /tmp/cf-v4.txt) ranges, v6: $(wc -l < /tmp/cf-v6.txt) ranges"

scp -o StrictHostKeyChecking=no /tmp/cf-v4.txt /tmp/cf-v6.txt /tmp/restore-cf-remote.sh root@10.0.0.3:/tmp/

ssh -o StrictHostKeyChecking=no root@10.0.0.3 'bash /tmp/restore-cf-remote.sh'

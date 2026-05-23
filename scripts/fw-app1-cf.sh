#!/bin/bash
# Run ON aivo-app1. Mirror the CF-restricted 80/443 rules onto app1's own ufw.
set -euo pipefail

if ! command -v ufw >/dev/null 2>&1; then
  echo "ufw not installed on app1; checking iptables INPUT policy"
  iptables -L INPUT -n | head -5
  echo "ASSUMING no host firewall — skipping rules"
  exit 0
fi

ufw status | head -2

# Clear existing 80/443 ALLOW rules to start fresh
while :; do
  n=$(ufw status numbered | grep -E '\] (80|443)/tcp\s+ALLOW IN' | head -1 | sed -E 's/^\[\s*([0-9]+)\].*/\1/' || true)
  [ -z "${n:-}" ] && break
  yes | ufw delete "$n" >/dev/null || break
done

curl -fsS https://www.cloudflare.com/ips-v4 > /tmp/cf-v4.txt
curl -fsS https://www.cloudflare.com/ips-v6 > /tmp/cf-v6.txt

add() {
  local f="$1" tag="$2"
  while IFS= read -r cidr; do
    [ -z "$cidr" ] && continue
    ufw allow proto tcp from "$cidr" to any port 80 comment "CF $tag HTTP" >/dev/null
    ufw allow proto tcp from "$cidr" to any port 443 comment "CF $tag HTTPS" >/dev/null
  done < "$f"
}
add /tmp/cf-v4.txt v4
add /tmp/cf-v6.txt v6

ufw reload
echo "=== rule count for 80/443 ==="
ufw status | grep -cE '(80|443)/tcp' || true

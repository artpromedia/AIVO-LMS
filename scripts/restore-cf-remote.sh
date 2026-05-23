#!/bin/bash
# Runs ON aivo-app2. Reads /tmp/cf-v4.txt and /tmp/cf-v6.txt, installs ufw rules.
set -euo pipefail

# Remove any existing ALLOW rules for 80/tcp or 443/tcp (clean slate).
while :; do
  n=$(ufw status numbered | grep -E '\] (80|443)/tcp\s+ALLOW IN' | head -1 | sed -E 's/^\[\s*([0-9]+)\].*/\1/' || true)
  [ -z "${n:-}" ] && break
  yes | ufw delete "$n" >/dev/null || break
done

add_rules() {
  local file="$1" label="$2"
  while IFS= read -r cidr; do
    [ -z "$cidr" ] && continue
    ufw allow proto tcp from "$cidr" to any port 80 comment "CF $label HTTP" >/dev/null
    ufw allow proto tcp from "$cidr" to any port 443 comment "CF $label HTTPS" >/dev/null
  done < "$file"
}

add_rules /tmp/cf-v4.txt v4
add_rules /tmp/cf-v6.txt v6

ufw reload
echo
echo "=== rule count for 80/443 ==="
ufw status | grep -cE '(80|443)/tcp' || true
echo
echo "=== sample (first 6) ==="
ufw status | grep -E '(80|443)/tcp' | head -6

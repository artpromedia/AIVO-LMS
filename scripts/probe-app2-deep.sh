#!/bin/bash
set -u
echo "=== from app2 itself (private 10.0.0.3) ==="
ssh -o StrictHostKeyChecking=no root@10.0.0.3 'curl -sI -k --max-time 5 --resolve aivolearning.com:443:127.0.0.1 https://aivolearning.com/ | head -3; echo; echo "=== nginx access tail ==="; tail -20 /var/log/nginx/access.log 2>/dev/null || echo no-access-log; echo; echo "=== nginx error tail ==="; tail -20 /var/log/nginx/error.log 2>/dev/null || echo no-error-log; echo; echo "=== nginx process age ==="; ps -o pid,etime,cmd -p 4186996 2>/dev/null || echo no-pid; echo; echo "=== ufw / iptables INPUT ==="; ufw status 2>/dev/null | head -10; iptables -L INPUT -n --line-numbers | head -15; echo; echo "=== conntrack 443 ==="; ss -tn state established sport = :443 | head -10'

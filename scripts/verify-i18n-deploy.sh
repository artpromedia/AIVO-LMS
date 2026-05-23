#!/bin/bash
set -u
echo "=== pods ==="
kubectl -n aivo get pod -l 'app.kubernetes.io/name in (marketing-svc,web)' -o wide 2>/dev/null | grep -v Completed
echo
echo "=== logs marketing tail ==="
POD=$(kubectl -n aivo get pod -l app.kubernetes.io/name=marketing-svc -o jsonpath='{.items[0].metadata.name}')
kubectl -n aivo logs "$POD" --tail=20 2>&1 | grep -iE 'error|warn|ready|started|listen' | head -10
echo
echo "=== curl marketing EN ==="
curl -sI https://aivolearning.com/ | head -3
echo
echo "=== curl marketing DE cookie ==="
curl -s -b 'aivo_locale=de' https://aivolearning.com/ -o /tmp/de.html
grep -oE 'Anmelden|Loslegen|Kostenlos|Entdecken|Lernen' /tmp/de.html | sort -u | head -10
echo "lang attr:"
grep -oE 'lang="[a-z]+"' /tmp/de.html | head -1
echo
echo "=== curl web ==="
curl -sI https://app.aivolearning.com/ | head -3

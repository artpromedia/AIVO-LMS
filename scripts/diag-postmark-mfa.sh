#!/usr/bin/env bash
# Queries Postmark for the delivery status of the two MFA messages
# already accepted by the API. status=sent in our outbox only means
# Postmark's HTTP endpoint accepted the JSON -- it does NOT mean the
# message was delivered. Postmark returns the same accepted/MessageID
# even when the recipient is on the suppression list, in which case
# the message is dropped before any SMTP attempt.
set -euo pipefail

TOKEN="$(kubectl -n aivo get deploy comms-svc -o jsonpath='{range .spec.template.spec.containers[0].env[*]}{.name}|{.value}{"\n"}{end}' | grep '^POSTMARK_API_TOKEN|' | cut -d'|' -f2)"
if [[ -z "$TOKEN" ]]; then
  echo "ERROR: no POSTMARK_API_TOKEN in comms-svc env" >&2
  exit 1
fi

for MSG in 60d9b811-7039-40c0-b335-867380ec20b9 185e14d5-1074-4149-8c6e-944098b87713; do
  echo "=== $MSG ==="
  curl -sS \
    -H "Accept: application/json" \
    -H "X-Postmark-Server-Token: $TOKEN" \
    "https://api.postmarkapp.com/messages/outbound/$MSG/details" \
    | python3 -m json.tool 2>/dev/null || echo "(failed)"
  echo
  echo "--- bounce/suppression check ---"
  curl -sS \
    -H "Accept: application/json" \
    -H "X-Postmark-Server-Token: $TOKEN" \
    "https://api.postmarkapp.com/messages/outbound/$MSG/dump" \
    | python3 -c 'import sys, json; d=json.load(sys.stdin); print(json.dumps({k:v for k,v in d.items() if k!="Body"}, indent=2))' 2>/dev/null || true
  echo
done

echo "=== suppression check for iamdrofem@gmail.com (and +platform) ==="
curl -sS \
  -H "Accept: application/json" \
  -H "X-Postmark-Server-Token: $TOKEN" \
  "https://api.postmarkapp.com/message-streams/outbound/suppressions/dump?emailaddress=iamdrofem@gmail.com" \
  | python3 -m json.tool 2>/dev/null || echo "(failed)"
echo
curl -sS \
  -H "Accept: application/json" \
  -H "X-Postmark-Server-Token: $TOKEN" \
  "https://api.postmarkapp.com/message-streams/outbound/suppressions/dump?emailaddress=iamdrofem+platform@gmail.com" \
  | python3 -m json.tool 2>/dev/null || echo "(failed)"

echo
echo "=== sender signature / domain status ==="
curl -sS \
  -H "Accept: application/json" \
  -H "X-Postmark-Account-Token: $TOKEN" \
  "https://api.postmarkapp.com/domains" \
  | python3 -m json.tool 2>/dev/null | head -40 || echo "(server token cannot list domains -- need account token)"

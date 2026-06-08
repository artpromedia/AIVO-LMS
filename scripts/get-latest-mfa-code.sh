#!/usr/bin/env bash
# Retrieves the most recent MFA code from Postmark for a given email.
# Use when Gmail routes the OTP to Spam/Promotions and you need to
# unblock a demo sign-in quickly.
#
# Usage: bash get-latest-mfa-code.sh iamdrofem+platform@gmail.com
set -euo pipefail

EMAIL="${1:-}"
if [[ -z "$EMAIL" ]]; then
  echo "usage: $0 <email>" >&2
  exit 1
fi

TOKEN="$(kubectl -n aivo get deploy comms-svc -o jsonpath='{range .spec.template.spec.containers[0].env[*]}{.name}|{.value}{"\n"}{end}' | grep '^POSTMARK_API_TOKEN|' | cut -d'|' -f2)"
if [[ -z "$TOKEN" ]]; then
  echo "ERROR: no POSTMARK_API_TOKEN in comms-svc env" >&2
  exit 1
fi

# 1) Get most recent mfa_code tagged message for the recipient.
MID="$(curl -sS \
  -H "Accept: application/json" \
  -H "X-Postmark-Server-Token: $TOKEN" \
  "https://api.postmarkapp.com/messages/outbound?recipient=$(printf %s "$EMAIL" | python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read().strip()))')&tag=mfa_code&count=1&offset=0" \
  | python3 -c 'import sys, json; d=json.load(sys.stdin); print((d.get("Messages") or [{}])[0].get("MessageID",""))')"

if [[ -z "$MID" ]]; then
  echo "No mfa_code message found for $EMAIL" >&2
  exit 1
fi

echo "Latest MFA MessageID: $MID"

# 2) Fetch its details + delivery status.
DETAILS="$(curl -sS \
  -H "Accept: application/json" \
  -H "X-Postmark-Server-Token: $TOKEN" \
  "https://api.postmarkapp.com/messages/outbound/$MID/details")"

PARSER=$(mktemp)
cat > "$PARSER" <<'PYEOF'
import sys, json, re
d = json.load(sys.stdin)
print("Subject :", d.get("Subject"))
print("To      :", d.get("To"))
print("Sent at :", d.get("ReceivedAt"))
for e in d.get("MessageEvents", []):
    detail = e.get("Details", {}) or {}
    msg = detail.get("DeliveryMessage") or detail.get("Summary", "")
    print(f"  -> {e.get('Type')}: {msg}")
text = d.get("TextBody", "")
m = re.search(r"\b(\d{6})\b", text)
print("CODE    :", m.group(1) if m else "(could not parse)")
PYEOF
echo "$DETAILS" | python3 "$PARSER"
rm -f "$PARSER"

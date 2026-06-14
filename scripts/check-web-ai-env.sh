#!/usr/bin/env bash
# Probe whether the live web deployment + aivo-common-env resolve a real AI
# tutor provider. The zero-stub merge makes getTutorProvider() THROW in
# production when AI_PROVIDER!=anthropic or ANTHROPIC_API_KEY is absent, so
# lesson generation would hard-fail without these.
set -euo pipefail
NS=aivo

echo "=== web image ==="
kubectl -n "$NS" get deploy web -o jsonpath='{.spec.template.spec.containers[0].image}'
echo

echo "=== web deployment inline env (AI-related) ==="
kubectl -n "$NS" get deploy web -o yaml | grep -Ei 'AI_PROVIDER|ANTHROPIC|NODE_ENV' || echo "(none inline)"

echo "=== web envFrom sources ==="
kubectl -n "$NS" get deploy web -o jsonpath='{range .spec.template.spec.containers[0].envFrom[*]}{.secretRef.name}{" (secret)\n"}{.configMapRef.name}{" (cm)\n"}{end}' || true
echo

echo "=== aivo-common-env: AI keys present? (values masked) ==="
for k in AI_PROVIDER ANTHROPIC_API_KEY OPENAI_API_KEY GOOGLE_API_KEY NODE_ENV; do
  v=$(kubectl -n "$NS" get secret aivo-common-env -o jsonpath="{.data.$k}" 2>/dev/null || true)
  if [ -n "$v" ]; then
    dec=$(printf '%s' "$v" | base64 -d 2>/dev/null || echo '?')
    case "$k" in
      *API_KEY) echo "$k = SET (len ${#dec})" ;;
      *) echo "$k = $dec" ;;
    esac
  else
    echo "$k = (absent)"
  fi
done

echo "=== running web pod: resolved env (AI-related) ==="
POD=$(kubectl -n "$NS" get pods -l app=web -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || kubectl -n "$NS" get pods | awk '/^web-/{print $1; exit}')
if [ -n "${POD:-}" ]; then
  echo "pod: $POD"
  kubectl -n "$NS" exec "$POD" -- sh -lc 'echo "AI_PROVIDER=$AI_PROVIDER NODE_ENV=$NODE_ENV ANTHROPIC_API_KEY_len=${#ANTHROPIC_API_KEY} OPENAI_API_KEY_len=${#OPENAI_API_KEY}"' 2>/dev/null || echo "(exec failed)"
fi

echo "=== ANTHROPIC_API_KEY validity probe (status only — same call the boot probe makes) ==="
AKEY=$(kubectl -n "$NS" get secret aivo-common-env -o jsonpath='{.data.ANTHROPIC_API_KEY}' 2>/dev/null | base64 -d 2>/dev/null || true)
if [ -n "$AKEY" ]; then
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 \
    -H "x-api-key: $AKEY" -H "anthropic-version: 2023-06-01" \
    https://api.anthropic.com/v1/models 2>/dev/null || echo "curl-failed")
  echo "api.anthropic.com/v1/models -> HTTP $CODE  (200=valid, 401/403=rejected -> would FATAL boot)"
else
  echo "(no ANTHROPIC_API_KEY to probe)"
fi

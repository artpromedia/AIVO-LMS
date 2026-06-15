#!/usr/bin/env bash
# Apply migration 0090_billing_coupons.sql via one-shot psql pod
set -e
cd /opt/aivo-deploy/AIVO-LMS

MIG_FILE="packages/db/drizzle/0090_billing_coupons.sql"
if [ ! -f "$MIG_FILE" ]; then echo "Missing $MIG_FILE"; exit 1; fi

PGURL=$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)
if [ -z "$PGURL" ]; then echo "No PGURL"; exit 1; fi

echo "=== migration content (first 30 lines) ==="
head -30 "$MIG_FILE"
echo "=== applying ==="

cat "$MIG_FILE" | kubectl -n aivo run "mig-0090-${RANDOM}" --rm -i \
  --image=postgres:16-alpine --restart=Never \
  --env=PGURL="$PGURL" -- \
  psql "$PGURL" -v ON_ERROR_STOP=1 -f -

echo "=== verify tables created ==="
echo "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%coupon%' ORDER BY tablename;" | \
  kubectl -n aivo run "verify-0090-${RANDOM}" --rm -i \
  --image=postgres:16-alpine --restart=Never \
  --env=PGURL="$PGURL" -- \
  psql "$PGURL" -f -

echo "=== done ==="

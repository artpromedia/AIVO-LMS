#!/usr/bin/env bash
# Seeds two demo admin accounts in production:
#   - Platform Super Admin (role=PLATFORM_ADMIN, no tenant)
#   - District Admin       (role=DISTRICT_ADMIN, tenant=Demo District)
#
# Both rows replace any prior demo row with the same email so the script
# is re-runnable. argon2id hashing happens inside a one-shot python pod
# (no host-side argon2 dependency). Passwords are generated with
# Python's `secrets` module and printed ONCE at the end — capture them
# immediately.
#
# MFA NOTE: Both PLATFORM_ADMIN and DISTRICT_ADMIN are in
# MFA_FORCED_ROLES (services/identity-svc/src/routes/auth.ts:345), so
# every sign-in triggers an email OTP. The demo emails use Gmail
# +aliases so codes land in iamdrofem@gmail.com.
set -euo pipefail

PYSCRIPT=/tmp/seed-demo-admins.py
cat > "$PYSCRIPT" <<'PYEOF'
import os
import secrets
from argon2 import PasswordHasher
import psycopg2
import psycopg2.extras

PLATFORM_EMAIL = "iamdrofem+platform@gmail.com"
PLATFORM_NAME = "Demo Platform Admin"
DISTRICT_EMAIL = "iamdrofem+district@gmail.com"
DISTRICT_NAME = "Demo District Admin"
DISTRICT_TENANT_NAME = "Demo District"


def gen_pw() -> str:
    """20-char password meeting common policy: mixed case + digit + symbol."""
    alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    body = "".join(secrets.choice(alphabet) for _ in range(16))
    # Guaranteed symbol/digit/upper/lower satisfies every reasonable
    # password policy without picking shell-troublesome characters.
    return body + "Aa9!"


platform_pw = gen_pw()
district_pw = gen_pw()

hasher = PasswordHasher()
platform_hash = hasher.hash(platform_pw)
district_hash = hasher.hash(district_pw)

conn = psycopg2.connect(os.environ["PGURL"])
conn.autocommit = False
try:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        # 1) Ensure Demo District tenant exists.
        cur.execute(
            """
            INSERT INTO tenants (name, type, settings, status)
            SELECT %s, 'B2B_DISTRICT', '{}'::jsonb, 'ACTIVE'
            WHERE NOT EXISTS (
              SELECT 1 FROM tenants
              WHERE name = %s AND type = 'B2B_DISTRICT'
            );
            """,
            (DISTRICT_TENANT_NAME, DISTRICT_TENANT_NAME),
        )
        cur.execute(
            """
            SELECT id FROM tenants
            WHERE name = %s AND type = 'B2B_DISTRICT'
            ORDER BY created_at ASC LIMIT 1;
            """,
            (DISTRICT_TENANT_NAME,),
        )
        tenant_id = cur.fetchone()["id"]

        # 2) Platform admin (no tenant). Replace existing row by email.
        cur.execute("DELETE FROM users WHERE email = %s;", (PLATFORM_EMAIL,))
        cur.execute(
            """
            INSERT INTO users (
              email, password_hash, name, role,
              email_verified, mfa_enabled, must_change_password,
              password_changed_at
            ) VALUES (%s, %s, %s, 'PLATFORM_ADMIN',
                      true, false, false, now())
            RETURNING id;
            """,
            (PLATFORM_EMAIL, platform_hash, PLATFORM_NAME),
        )
        platform_id = cur.fetchone()["id"]

        # 3) District admin scoped to the demo district.
        cur.execute("DELETE FROM users WHERE email = %s;", (DISTRICT_EMAIL,))
        cur.execute(
            """
            INSERT INTO users (
              tenant_id, email, password_hash, name, role,
              email_verified, mfa_enabled, must_change_password,
              password_changed_at
            ) VALUES (%s, %s, %s, %s, 'DISTRICT_ADMIN',
                      true, false, false, now())
            RETURNING id;
            """,
            (tenant_id, DISTRICT_EMAIL, district_hash, DISTRICT_NAME),
        )
        district_id = cur.fetchone()["id"]

    conn.commit()
finally:
    conn.close()

print("---DEMO-CREDENTIALS-START---")
print(f"PLATFORM_EMAIL    = {PLATFORM_EMAIL}")
print(f"PLATFORM_PASSWORD = {platform_pw}")
print(f"PLATFORM_USER_ID  = {platform_id}")
print(f"DISTRICT_EMAIL    = {DISTRICT_EMAIL}")
print(f"DISTRICT_PASSWORD = {district_pw}")
print(f"DISTRICT_USER_ID  = {district_id}")
print(f"DISTRICT_TENANT_ID= {tenant_id}")
print("---DEMO-CREDENTIALS-END---")
PYEOF

PGURL="$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)"
if [[ -z "$PGURL" ]]; then
  echo "ERROR: db-secrets/database-url empty" >&2
  exit 1
fi

POD="demo-admins-seed-$RANDOM"
kubectl -n aivo run "$POD" \
  --rm -i --restart=Never \
  --image=python:3.11-slim \
  --env="PGURL=$PGURL" \
  --command -- bash -c '
    set -euo pipefail
    pip install -q --no-cache-dir argon2-cffi psycopg2-binary >/tmp/pip.log 2>&1 \
      || { cat /tmp/pip.log >&2; exit 1; }
    python /dev/stdin
  ' < "$PYSCRIPT"

rm -f "$PYSCRIPT"

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
# every sign-in triggers an email OTP. The platform admin uses a
# Gmail +alias (iamdrofem+platform@) so codes land in iamdrofem@gmail.com;
# the district admin uses a separate Gmail inbox so two demo personas
# can be signed in side-by-side without OTP collisions.
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
DISTRICT_EMAIL = "nkechinyerepkanu@gmail.com"
# Prior district demo emails that should be removed if still present.
# Add older addresses here whenever the demo email is rotated.
DISTRICT_EMAIL_LEGACY = ("iamdrofem+district@gmail.com",)
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

        # 2) Platform admin (no tenant). UPSERT by email so re-runs
        #    rotate the password without nuking sessions / audit FKs.
        cur.execute(
            """
            INSERT INTO users (
              email, password_hash, name, role,
              email_verified, mfa_enabled, must_change_password,
              password_changed_at
            ) VALUES (%s, %s, %s, 'PLATFORM_ADMIN',
                      true, false, false, now())
            ON CONFLICT (email) DO UPDATE SET
              password_hash       = EXCLUDED.password_hash,
              name                = EXCLUDED.name,
              role                = EXCLUDED.role,
              tenant_id           = NULL,
              email_verified      = true,
              mfa_enabled         = false,
              must_change_password = false,
              password_changed_at = now()
            RETURNING id;
            """,
            (PLATFORM_EMAIL, platform_hash, PLATFORM_NAME),
        )
        platform_id = cur.fetchone()["id"]

        # 3) District admin scoped to the demo district.
        #    Tombstone legacy demo emails (preserves audit FKs, blocks login).
        for legacy in DISTRICT_EMAIL_LEGACY:
            cur.execute(
                """
                UPDATE users
                SET email = 'tombstone+' || id::text || '@deleted.aivolearning.com',
                    mfa_enabled = false,
                    must_change_password = true,
                    password_hash = ''
                WHERE email = %s;
                """,
                (legacy,),
            )
        cur.execute(
            """
            INSERT INTO users (
              tenant_id, email, password_hash, name, role,
              email_verified, mfa_enabled, must_change_password,
              password_changed_at
            ) VALUES (%s, %s, %s, %s, 'DISTRICT_ADMIN',
                      true, false, false, now())
            ON CONFLICT (email) DO UPDATE SET
              tenant_id           = EXCLUDED.tenant_id,
              password_hash       = EXCLUDED.password_hash,
              name                = EXCLUDED.name,
              role                = EXCLUDED.role,
              email_verified      = true,
              mfa_enabled         = false,
              must_change_password = false,
              password_changed_at = now()
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

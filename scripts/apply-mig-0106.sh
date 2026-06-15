#!/usr/bin/env bash
# Apply migration 0106 (RLS backstop) to prod — run ON aivo-app1:
#   bash /opt/aivo-deploy/apply-mig-0106.sh
#
# 0106 needs CREATE ROLE + GRANT + ALTER TABLE ... ENABLE RLS, so it runs
# as the postgres superuser on aivo-db1 (peer auth over SSH), NOT as
# aivo_app via a kubectl Job.
#
# SAFETY: RLS without FORCE does not bind table OWNERS. Prod services all
# connect as aivo_app, so every RLS'd table MUST be owned by aivo_app or
# enabling RLS blanks out production reads. This script transfers
# ownership to aivo_app first (0062 lesson: drift tables are owned by
# postgres), then applies 0106, then proves aivo_app still sees rows.
set -euo pipefail

DB_HOST=10.0.0.1
SQL_SRC=/opt/aivo-deploy/AIVO-LMS/packages/db/drizzle/0106_rls_backstop.sql
RLS_TABLES="users learners schools classrooms classroom_enrollments staff_assignments"
# Tables referenced inside policy subqueries — must be readable (and thus
# owned/granted consistently) too:
LINK_TABLES="learner_teachers learner_caregivers learner_therapists"

[ -f "$SQL_SRC" ] || { echo "FATAL: $SQL_SRC missing (sync the tree first)"; exit 1; }

echo "== 1. Current ownership =="
ssh -o StrictHostKeyChecking=accept-new root@$DB_HOST "sudo -u postgres psql -d aivo -At -c \"SELECT relname || '=' || relowner::regrole FROM pg_class WHERE relkind='r' AND relname = ANY(string_to_array('$RLS_TABLES $LINK_TABLES',' '));\""

echo "== 2. Transfer ownership of RLS tables to aivo_app (idempotent) =="
for t in $RLS_TABLES $LINK_TABLES; do
  ssh root@$DB_HOST "sudo -u postgres psql -d aivo -v ON_ERROR_STOP=1 -c \"ALTER TABLE IF EXISTS $t OWNER TO aivo_app;\""
done

echo "== 3. Apply 0106 as postgres =="
# strip drizzle statement-breakpoint markers; psql runs the rest verbatim
sed 's/^--> statement-breakpoint$//' "$SQL_SRC" > /tmp/0106.clean.sql
scp -q /tmp/0106.clean.sql root@$DB_HOST:/tmp/0106.clean.sql
ssh root@$DB_HOST "sudo -u postgres psql -d aivo -v ON_ERROR_STOP=1 -f /tmp/0106.clean.sql && rm -f /tmp/0106.clean.sql"

echo "== 4. Verify =="
ssh root@$DB_HOST "sudo -u postgres psql -d aivo -At -c \"SELECT 'role_exists=' || count(*) FROM pg_roles WHERE rolname='app_runtime';\""
ssh root@$DB_HOST "sudo -u postgres psql -d aivo -At -c \"SELECT 'policies=' || count(*) FROM pg_policies WHERE tablename = ANY(string_to_array('$RLS_TABLES',' '));\""
ssh root@$DB_HOST "sudo -u postgres psql -d aivo -At -c \"SELECT 'rls_enabled=' || count(*) FROM pg_class WHERE relrowsecurity AND relname = ANY(string_to_array('$RLS_TABLES',' '));\""

echo "== 5. aivo_app (owner) must still see rows =="
PGURL=$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)
kubectl -n aivo run mig0106-verify-$RANDOM --rm -i --restart=Never --image=postgres:16-alpine \
  --env="PGURL=$PGURL" -- sh -c 'psql "$PGURL" -At -c "SELECT '\''aivo_app_users='\'' || count(*) FROM users; SELECT '\''aivo_app_learners='\'' || count(*) FROM learners;"'

echo "DONE — app_runtime is provisioned but NO prod service uses it yet (per-service opt-in)."

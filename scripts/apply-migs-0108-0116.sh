#!/usr/bin/env bash
# Apply assessment-UX migrations 0108-0116 to prod — run ON aivo-app1:
#   bash /opt/aivo-deploy/apply-migs-0108-0116.sh
#
# All 9 run as the postgres superuser on aivo-db1 (peer auth over SSH),
# because they ENABLE RLS (0110/0113), ALTER existing possibly-drift-owned
# tables (0108 learner_brain_profiles, 0111 the 4 invite tables), and CREATE
# the new RLS tables.
#
# OWNERSHIP MODEL (docs/runbooks/persistence-postgres.md): the web-v2
# persistence layer connects as the NON-OWNER role aivo_app and sets the GUC
# `app.current_tenant` per request via withTenantContext. RLS without FORCE
# only binds NON-owners, so the new RLS tables (web_teacher_assessments,
# web_therapist_assessments) MUST stay postgres-owned for isolation to
# enforce — running CREATE as postgres does exactly that. The GRANT in
# 0110/0113 gives aivo_app DML. (OPPOSITE of 0106, whose tables are
# aivo_app-owned because 0106 created a separate app_runtime role.)
#
# Idempotent: every file is CREATE TABLE/INDEX IF NOT EXISTS, ADD COLUMN IF
# NOT EXISTS, or DROP POLICY IF EXISTS + CREATE POLICY — safe to re-run.
#
# All SQL crosses the double-ssh boundary as FILES (-f), never inline -c, to
# avoid PowerShell/bash nested-quote mangling of parens/quotes/||.
set -euo pipefail

DB_HOST=10.0.0.1
MIG_DIR=/opt/aivo-deploy/migs-c
MIGS="0108_brain_profile_approvals 0109_web_teacher_assessments 0110_web_teacher_assessments_rls 0111_invite_reminder_latches 0112_web_therapist_assessments 0113_web_therapist_assessments_rls 0114_web_child_profile_disclosures 0115_brain_profile_changes 0116_contribution_acknowledgements"

run_sql_file() { # $1 = local sql path on app1
  local f="$1" base
  base=$(basename "$f")
  scp -q -o StrictHostKeyChecking=accept-new "$f" "root@$DB_HOST:/tmp/$base"
  ssh -o StrictHostKeyChecking=accept-new root@$DB_HOST \
    "sudo -u postgres psql -d aivo -v ON_ERROR_STOP=1 -f /tmp/$base; rc=\$?; rm -f /tmp/$base; exit \$rc"
}

echo "== 0. Prerequisite tables present? (fails the run before any change) =="
cat > /tmp/migc-prereq.sql <<'SQL'
DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(t, ', ') INTO missing
  FROM unnest(ARRAY[
    'learner_brain_profiles','learner_teachers','learner_caregivers',
    'learner_therapists','teacher_parent_invites'
  ]) AS t
  WHERE to_regclass('public.'||t) IS NULL;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'prerequisite tables missing in prod: %', missing;
  END IF;
  RAISE NOTICE 'all prerequisite tables exist';
END $$;
SQL
run_sql_file /tmp/migc-prereq.sql

echo "== 1. Apply 0108-0116 in order (postgres, ON_ERROR_STOP) =="
for m in $MIGS; do
  SRC="$MIG_DIR/${m}.sql"
  [ -f "$SRC" ] || { echo "FATAL: $SRC missing (sync step did not run)"; exit 1; }
  echo "--- $m ---"
  sed 's/^--> statement-breakpoint$//' "$SRC" > "/tmp/${m}.clean.sql"
  run_sql_file "/tmp/${m}.clean.sql"
  rm -f "/tmp/${m}.clean.sql"
done

echo "== 2. Verify schema (tables, columns, RLS, policy, owner, grant) =="
cat > /tmp/migc-verify.sql <<'SQL'
\pset tuples_only on
\pset format unaligned
SELECT 'table '||t||'='||CASE WHEN to_regclass('public.'||t) IS NULL THEN 'MISSING' ELSE 'ok' END
FROM unnest(ARRAY['brain_profile_approvals','web_teacher_assessments','web_therapist_assessments',
  'web_child_profile_disclosures','brain_profile_changes','contribution_acknowledgements']) AS t;
SELECT 'learner_brain_profiles.revision='||count(*) FROM information_schema.columns
  WHERE table_name='learner_brain_profiles' AND column_name='revision';
SELECT 'invite_nudge_cols(expect 7)='||count(*) FROM information_schema.columns
  WHERE column_name IN ('contribution_nudge_last_sent_at','contribution_nudge_opt_out','expiry_warning_sent_at')
    AND table_name IN ('learner_teachers','learner_caregivers','learner_therapists','teacher_parent_invites');
SELECT 'rls_enabled(expect 2)='||count(*) FROM pg_class
  WHERE relrowsecurity AND relname IN ('web_teacher_assessments','web_therapist_assessments');
SELECT 'policies(expect 2)='||count(*) FROM pg_policies
  WHERE tablename IN ('web_teacher_assessments','web_therapist_assessments') AND policyname='tenant_isolation';
SELECT 'owner '||relname||'='||relowner::regrole FROM pg_class
  WHERE relname IN ('web_teacher_assessments','web_therapist_assessments') ORDER BY relname;
SELECT 'grant_'||table_name||'='||string_agg(privilege_type, ',' ORDER BY privilege_type)
  FROM information_schema.role_table_grants
  WHERE grantee='aivo_app' AND table_name IN ('web_teacher_assessments','web_therapist_assessments')
  GROUP BY table_name ORDER BY table_name;
SQL
run_sql_file /tmp/migc-verify.sql
rm -f /tmp/migc-prereq.sql /tmp/migc-verify.sql

echo "== 3. aivo_app RLS smoke (in-cluster; sets app.current_tenant, rolls back) =="
PGURL=$(kubectl -n aivo get secret db-secrets -o jsonpath='{.data.database-url}' | base64 -d)
cat > /tmp/migc-smoke.sql <<'SQL'
\pset tuples_only on
\pset format unaligned
BEGIN;
SELECT set_config('app.current_tenant', 'mig-c-smoke-tenant', true);
INSERT INTO web_teacher_assessments (id, learner_id, tenant_id, submitted_by_user_id, data)
  VALUES ('mig-c-smoke', 'l1', 'mig-c-smoke-tenant', 'u1', '{}'::jsonb);
SELECT 'aivo_app_in_tenant_sees='||count(*) FROM web_teacher_assessments WHERE id='mig-c-smoke';
ROLLBACK;
SELECT set_config('app.current_tenant', 'some-other-tenant', true);
SELECT 'cross_tenant_sees(expect 0)='||count(*) FROM web_teacher_assessments WHERE id='mig-c-smoke';
SQL
SMOKE_B64=$(base64 -w0 /tmp/migc-smoke.sql)
kubectl -n aivo run mig-c-verify-$RANDOM --rm -i --restart=Never --image=postgres:16-alpine \
  --env="PGURL=$PGURL" --env="SMOKE_B64=$SMOKE_B64" -- \
  sh -c 'echo "$SMOKE_B64" | base64 -d > /tmp/s.sql; psql "$PGURL" -v ON_ERROR_STOP=1 -f /tmp/s.sql'
rm -f /tmp/migc-smoke.sql

echo "DONE — 0108-0116 applied. New RLS tables postgres-owned (RLS enforces on aivo_app); approvals/changes/acknowledgements/disclosures are app-scoped (no RLS, by design)."

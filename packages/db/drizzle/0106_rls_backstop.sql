-- Sprint 14 — Postgres row-level security backstop (audit gap M10).
--
-- Tenant isolation no longer depends solely on every service remembering
-- its WHERE tenant_id = … clause. This migration:
--   1. creates the non-bypassing `app_runtime` role (LOGIN, no password
--      here — compose/deploy sets it via ALTER ROLE from env so secrets
--      never live in a migration);
--   2. grants it ordinary DML on the public schema (current + future
--      tables/sequences via default privileges);
--   3. enables RLS with tenant policies on the core tenant tables.
--
-- ROLLOUT MODEL (read this before extending):
--   * RLS without FORCE does NOT bind table owners — every service still
--     connecting as the owner/migration role behaves exactly as before.
--     Enforcement turns on per service by switching its DATABASE_URL to
--     app_runtime and threading withTenantContext (packages/db/src/
--     tenant-context.ts). family-svc is the reference adoption; the
--     playbook is docs/security/rls-rollout.md.
--   * Policies read current_setting('app.tenant_id', true); the second
--     argument makes an unset context yield NULL → comparison is false →
--     ZERO rows. Fail-closed for app_runtime, invisible for owners.
--
-- PER-TABLE POLICY DECISIONS:
--   users        tenant_id is NULLABLE: platform staff rows carry NULL.
--                Under a tenant context those rows are INVISIBLE to
--                app_runtime — correct for tenant-scoped services, which
--                must never enumerate platform staff. Platform-scoped
--                reads stay on owner-role services (admin-svc) until a
--                dedicated platform policy ships.
--   learners     tenant_id NOT NULL — straight tenant match, PLUS a
--                SELECT-only policy keyed on app.user_id: family
--                collaboration is cross-tenant BY DESIGN (a B2C parent
--                invites a school-tenant teacher), so an ACCEPTED link in
--                learner_teachers / learner_caregivers / learner_therapists
--                grants read visibility of that one learner to that one
--                user. The link tables are the authorization source of
--                truth and are written only through ownership-gated invite
--                routes. Permissive policies OR together.
--   schools      tenant_id NOT NULL — straight tenant match.
--   classrooms   no tenant column; tenant derived via school_id. The
--                subquery runs under the SAME role, so schools' own
--                policy applies inside it (defense in depth, no
--                recursion: schools' policy is a plain comparison).
--   classroom_enrollments  no tenant column; derived via learner_id.
--   staff_assignments      no tenant column; derived via school_id.
--   nces_districts / zip_nces_district are PUBLIC reference data (no
--   tenant semantics) — intentionally not RLS'd.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime LOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;
--> statement-breakpoint
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS users_tenant_isolation ON users;
--> statement-breakpoint
CREATE POLICY users_tenant_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE learners ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS learners_tenant_isolation ON learners;
--> statement-breakpoint
CREATE POLICY learners_tenant_isolation ON learners
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
DROP POLICY IF EXISTS learners_collaboration_read ON learners;
--> statement-breakpoint
CREATE POLICY learners_collaboration_read ON learners FOR SELECT
  USING (
    id IN (
      SELECT learner_id FROM learner_teachers
        WHERE teacher_user_id = current_setting('app.user_id', true)::uuid
          AND status = 'ACCEPTED'
      UNION
      SELECT learner_id FROM learner_caregivers
        WHERE caregiver_user_id = current_setting('app.user_id', true)::uuid
          AND status = 'ACCEPTED'
      UNION
      SELECT learner_id FROM learner_therapists
        WHERE therapist_user_id = current_setting('app.user_id', true)::uuid
          AND status = 'ACCEPTED'
    )
  );
--> statement-breakpoint
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS schools_tenant_isolation ON schools;
--> statement-breakpoint
CREATE POLICY schools_tenant_isolation ON schools
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS classrooms_tenant_isolation ON classrooms;
--> statement-breakpoint
CREATE POLICY classrooms_tenant_isolation ON classrooms
  USING (school_id IN (SELECT id FROM schools WHERE tenant_id = current_setting('app.tenant_id', true)::uuid))
  WITH CHECK (school_id IN (SELECT id FROM schools WHERE tenant_id = current_setting('app.tenant_id', true)::uuid));
--> statement-breakpoint
ALTER TABLE classroom_enrollments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS classroom_enrollments_tenant_isolation ON classroom_enrollments;
--> statement-breakpoint
CREATE POLICY classroom_enrollments_tenant_isolation ON classroom_enrollments
  USING (learner_id IN (SELECT id FROM learners WHERE tenant_id = current_setting('app.tenant_id', true)::uuid))
  WITH CHECK (learner_id IN (SELECT id FROM learners WHERE tenant_id = current_setting('app.tenant_id', true)::uuid));
--> statement-breakpoint
ALTER TABLE staff_assignments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS staff_assignments_tenant_isolation ON staff_assignments;
--> statement-breakpoint
CREATE POLICY staff_assignments_tenant_isolation ON staff_assignments
  USING (school_id IN (SELECT id FROM schools WHERE tenant_id = current_setting('app.tenant_id', true)::uuid))
  WITH CHECK (school_id IN (SELECT id FROM schools WHERE tenant_id = current_setting('app.tenant_id', true)::uuid));

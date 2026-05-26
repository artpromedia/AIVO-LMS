-- Sprint 1 (invite-flows) — introduce SCHOOL_ADMIN as a first-class role
-- distinct from DISTRICT_ADMIN. School admins manage teachers, classrooms,
-- and staff within a single school; they are scoped via users.school_id
-- and cannot see other schools in the tenant.
--
-- Also generalizes district_admin_invites so the same token-based invite
-- plumbing serves both DISTRICT_ADMIN and SCHOOL_ADMIN. The role column
-- is required (default DISTRICT_ADMIN to preserve existing rows); school_id
-- is set only when role = SCHOOL_ADMIN and must reference a school in the
-- same tenant.
--
-- Postgres ALTER TYPE … ADD VALUE is non-transactional, so the
-- `IF NOT EXISTS` clause makes this safe to re-run.

ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'SCHOOL_ADMIN';

ALTER TABLE "district_admin_invites"
  ADD COLUMN IF NOT EXISTS "role" varchar(32) NOT NULL DEFAULT 'DISTRICT_ADMIN',
  ADD COLUMN IF NOT EXISTS "school_id" uuid REFERENCES "schools"("id");

CREATE INDEX IF NOT EXISTS "idx_district_admin_invites_school"
  ON "district_admin_invites" ("school_id");

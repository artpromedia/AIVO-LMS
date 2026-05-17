-- Sprint task #12 — two new IEP roles and a tenant-licensing dimension.
--
-- 1. SPED_LEAD: school-scoped admin. Adds a value to user_role.
--    Postgres ALTER TYPE … ADD VALUE is non-transactional, so the
--    `IF NOT EXISTS` clause makes this safe to re-run.
--
-- 2. CASE_MANAGER is NOT a system role — it is a per-learner relationship
--    already modelled via iep_team_members.role = 'case_manager'. This
--    migration does NOT add a global CASE_MANAGER role; instead, the
--    application surfaces the existing per-learner row on the drafts
--    list (see assessment-svc/src/routes/iep-authoring.ts).
--
-- 3. Tenant licensing tier. Two new columns on tenants:
--      licensing_tier varchar(30)  — "B2C_PARENT_PAY" | "B2B_SEAT_LICENSED"
--      seat_limit     integer      — NULL = unlimited (B2C cap is 1 learner
--                                    per parent, enforced in app code)
--    Existing rows are backfilled from the tenant `type` so the application
--    can read the new column without a follow-up migration.

ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'SPED_LEAD';

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "licensing_tier" varchar(30),
  ADD COLUMN IF NOT EXISTS "seat_limit" integer;

UPDATE "tenants"
   SET "licensing_tier" = CASE
     WHEN "type" = 'B2C_FAMILY' THEN 'B2C_PARENT_PAY'
     ELSE 'B2B_SEAT_LICENSED'
   END
 WHERE "licensing_tier" IS NULL;

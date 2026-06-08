-- 0071_brain_insights_tenant_scope.sql
--
-- Sprint 2 (parent-assessment → collaborator invites → brain build):
-- make collaborator perspectives ("insights") tenant-scoped and
-- role-attributed so the pre-build invite step can be read back per
-- (learner, tenant) and so the brain builder (Sprint 4) can weight an
-- insight by who contributed it.
--
-- Design decision (documented in the PR): we REUSE the existing
-- `brain_insights` table (the InsightBody surface already wired into
-- POST /api/family/collaboration/:learnerId/insight) and the existing
-- per-role invite tables (learner_teachers / learner_caregivers /
-- learner_therapists) rather than introducing parallel
-- `collaborator_insights` / `collaborator_invites` tables. That keeps a
-- single source of truth and avoids a dual-write.
--
-- Both columns are NULLABLE: brain_insights already has rows (and other
-- writers — family-goals.ts) that predate tenant attribution. The
-- collaboration insight route populates them going forward; legacy rows
-- stay readable. No RLS policy is added here: unlike the web_* domain,
-- family-svc connects without setting `app.current_tenant`, so a
-- fail-closed RLS policy would block the service. Tenant isolation on
-- this surface is enforced at the route layer via parent-ownership /
-- accepted-member checks (see services/family-svc/src/routes/collaboration.ts
-- and the regression in services/family-svc/test/collaboration.test.ts).
--
-- See packages/db/src/schema/brain.ts for the drizzle definition.

ALTER TABLE "brain_insights" ADD COLUMN IF NOT EXISTS "tenant_id" uuid REFERENCES "tenants"("id");
--> statement-breakpoint

ALTER TABLE "brain_insights" ADD COLUMN IF NOT EXISTS "author_role" varchar(50);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_brain_insights_learner_tenant"
  ON "brain_insights" ("learner_id", "tenant_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_brain_insights_tenant"
  ON "brain_insights" ("tenant_id", "created_at");

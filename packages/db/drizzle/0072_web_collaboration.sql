-- 0072_web_collaboration.sql
--
-- Sprint 4 (parent-assessment → collaborator invites → brain build):
-- web-v2's own durable store for collaborator perspectives ("insights")
-- and accepted care-team members. Read by the brain builder so the
-- pre-build invite step measurably shapes the clone.
--
-- Mirrors the web-domain pattern (id/learner_id/tenant_id/data jsonb) used
-- by web_parent_assessments et al. (0049). RLS tenant_isolation follows the
-- same GUC-keyed policy as 0050 — the web-v2 drizzle adapter sets
-- app.current_tenant via withTenantContext (see Sprint 1), so these tables
-- are reachable by the aivo_app role while staying tenant-isolated.
--
-- See packages/db/src/schema/web-domain.ts for the drizzle definitions.

CREATE TABLE IF NOT EXISTS "web_collaborator_insights" (
  "id" text PRIMARY KEY NOT NULL,
  "learner_id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "web_collaborator_insights_idx"
  ON "web_collaborator_insights" ("learner_id", "tenant_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "web_collaborator_members" (
  "id" text PRIMARY KEY NOT NULL,
  "learner_id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "data" jsonb NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "web_collaborator_members_idx"
  ON "web_collaborator_members" ("learner_id", "tenant_id");
--> statement-breakpoint

ALTER TABLE "web_collaborator_insights" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_collaborator_insights";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_collaborator_insights"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint

ALTER TABLE "web_collaborator_members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_collaborator_members";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_collaborator_members"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

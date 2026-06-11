-- 0095_web_mastery_snapshots_rls.sql
--
-- Tenant-isolation RLS + app-role grant for web_mastery_snapshots (0094).
-- Matches web_skill_masteries' policy from 0050; the hermetic test schema
-- skips this file the same way it skips 0050.

ALTER TABLE "web_mastery_snapshots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_mastery_snapshots";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_mastery_snapshots"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "web_mastery_snapshots" TO aivo_app;

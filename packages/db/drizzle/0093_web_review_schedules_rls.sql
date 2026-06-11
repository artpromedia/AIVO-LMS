-- 0093_web_review_schedules_rls.sql
--
-- Tenant-isolation RLS + app-role grant for web_review_schedules (created in
-- 0092). Matches the policy applied to web_skill_masteries / web_learning_paths
-- in 0050. aivo_app exists in provisioned environments (0050); the hermetic
-- test schema skips this file the same way it skips 0050.

ALTER TABLE "web_review_schedules" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_review_schedules";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_review_schedules"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "web_review_schedules" TO aivo_app;

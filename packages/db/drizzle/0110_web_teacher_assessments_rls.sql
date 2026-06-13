-- 0110_web_teacher_assessments_rls.sql
--
-- Tenant-isolation RLS + app-role grant for web_teacher_assessments (0109).
-- Matches web_parent_assessments' policy from 0050; the hermetic contract-test
-- schema skips this file the same way it skips 0050. Policy keys off the
-- per-connection GUC `app.current_tenant`, set by withTenantContext().

ALTER TABLE "web_teacher_assessments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "web_teacher_assessments";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "web_teacher_assessments"
  USING (tenant_id = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "web_teacher_assessments" TO aivo_app;

-- RLS for teacher_lesson_assignments (ADR 0002), matching the policy on
-- the other tenant-scoped tables: the non-owner app role only sees /
-- writes rows for the tenant in app.current_tenant.

ALTER TABLE "teacher_lesson_assignments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "teacher_lesson_assignments";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "teacher_lesson_assignments"
  USING (tenant_id::text = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));

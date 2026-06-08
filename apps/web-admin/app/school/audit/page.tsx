import { requirePageRole } from "@aivo/admin-auth";
import { listAdminAuditLogs } from "@aivo/admin-api/audit";
import { AdminPageFrame } from "@aivo/admin-ui";
import { AuditLogTable } from "@/components/admin-tables";

export default async function SchoolAuditPage() {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  const entries = await listAdminAuditLogs(session, 200);

  return (
    <AdminPageFrame
      eyebrow="School"
      title="Audit log"
      description="Administrative actions recorded for your school."
    >
      <AuditLogTable entries={entries} />
    </AdminPageFrame>
  );
}

import { requirePlatformPage } from "@aivo/admin-auth";
import { listAdminAuditLogs } from "@aivo/admin-api/audit";
import { AdminPageFrame } from "@aivo/admin-ui";
import { AuditLogTable } from "@/components/admin-tables";

export default async function PlatformAuditPage() {
  const session = await requirePlatformPage("platform:read");
  const entries = await listAdminAuditLogs(session, 200);

  return (
    <AdminPageFrame
      eyebrow="Platform"
      title="Audit log"
      description="Immutable, hash-chained record of privileged administrative actions across the platform."
    >
      <AuditLogTable entries={entries} />
    </AdminPageFrame>
  );
}

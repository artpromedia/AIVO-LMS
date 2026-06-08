import { requirePageRole } from "@aivo/admin-auth";
import { listComplianceControls } from "@aivo/admin-api/compliance";
import { AdminPageFrame } from "@aivo/admin-ui";
import { ComplianceControlsTable } from "@/components/admin-tables";

export default async function SchoolCompliancePage() {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  const controls = await listComplianceControls(session);

  return (
    <AdminPageFrame
      eyebrow="School"
      title="Compliance"
      description="Control monitoring relevant to your school's data-protection obligations."
    >
      <ComplianceControlsTable controls={controls} />
    </AdminPageFrame>
  );
}

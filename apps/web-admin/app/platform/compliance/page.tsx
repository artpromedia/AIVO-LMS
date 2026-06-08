import { requirePlatformPage } from "@aivo/admin-auth";
import { listComplianceControls, listEvidenceBundles } from "@aivo/admin-api/compliance";
import { AdminPageFrame } from "@aivo/admin-ui";
import { ComplianceControlsTable, EvidenceBundlesTable } from "@/components/admin-tables";
import { AdminNavGrid } from "@/components/admin-nav";

const COMPLIANCE_NAV = [
  {
    href: "/platform/compliance/dsar",
    title: "DSAR queue",
    description: "Data subject access requests with SLA timers.",
  },
  {
    href: "/platform/compliance/retention",
    title: "Data retention",
    description: "Per-data-class retention windows and disposition.",
  },
];

export default async function PlatformCompliancePage() {
  const session = await requirePlatformPage("platform:read");
  const [controls, bundles] = await Promise.all([
    listComplianceControls(session),
    listEvidenceBundles(session),
  ]);

  return (
    <AdminPageFrame
      eyebrow="Platform"
      title="Compliance"
      description="Continuous control monitoring and downloadable evidence bundles for audits."
    >
      <AdminNavGrid heading="Privacy operations" items={COMPLIANCE_NAV} />

      <h2 className="mt-8 text-xl font-black">Controls</h2>
      <ComplianceControlsTable controls={controls} />

      <h2 className="mt-8 text-xl font-black">Evidence bundles</h2>
      <EvidenceBundlesTable bundles={bundles} />
    </AdminPageFrame>
  );
}

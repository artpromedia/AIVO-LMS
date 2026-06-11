/**
 * School audit access (Sprint B4).
 *
 * The audit ledger is recorded and scoped at the DISTRICT level
 * (district_activity_log has no per-school dimension), so school admins
 * cannot be shown a school-only slice — and showing them the whole
 * district's trail would leak other schools' activity. District-level
 * viewers are sent to the real audit log; school admins get the access
 * policy stated plainly. The previous version of this page called a
 * platform-permission API that could never return rows for either role.
 */
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";

export default async function SchoolAuditPage() {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  if (session.role === "district_admin" || session.role === "platform_admin") {
    redirect("/district/audit");
  }

  return (
    <AdminPageFrame
      eyebrow="School"
      title="Audit log"
      description="Administrative activity is recorded in your district's tamper-evident audit ledger."
    >
      <AdminCard className="mt-8 p-6">
        <h2 className="text-xl font-black">Managed by your district</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-700">
          Audit records — including who viewed learner data and when — are kept in a single
          hash-chained ledger scoped to the whole district, so individual entries cannot be
          altered or hidden per school. Access to view, export, and verify that ledger is held
          by district administrators.
        </p>
        <p className="mt-3 max-w-2xl text-sm text-slate-700">
          Need an extract for your school? Ask a district administrator to run a filtered export
          from the district audit page — the request itself will appear on the trail.
        </p>
      </AdminCard>
    </AdminPageFrame>
  );
}

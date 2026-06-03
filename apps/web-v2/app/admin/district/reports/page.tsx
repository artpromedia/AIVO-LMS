import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import { listReports } from "@/lib/services/reports-svc";
import { ReportCatalog } from "@/components/admin/reports/ReportCatalog";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  const scope = { role: session.role, tenantId: session.tenantId, actorId: session.userId };
  const { reports } = await listReports(scope);

  return (
    <AppShell
      role={session.role}
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District admin · Reports"
        title="Cross-tier reports"
        description="Run, download, and schedule analytics reports across your district."
        actions={
          <Link
            href="/admin/district/reports/schedules"
            className="inline-flex h-11 items-center rounded-full border border-iw-border bg-iw-raised px-5 text-sm font-semibold"
          >
            Schedules
          </Link>
        }
      />
      <ReportCatalog reports={reports} basePath="/admin/district/reports" />
    </AppShell>
  );
}

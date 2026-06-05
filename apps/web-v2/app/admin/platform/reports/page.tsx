import Link from "next/link";
import { Permission } from "@aivo/security";
import { requirePlatformPage } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { platformNavForSession } from "@/components/layout/role-shells";
import { ROLE_LABEL } from "@/lib/auth/types";
import { listReports } from "@/lib/services/reports-svc";
import { ReportCatalog } from "@/components/admin/reports/ReportCatalog";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePlatformPage(Permission.ReportsRead);
  const scope = { role: session.role, tenantId: session.tenantId, actorId: session.userId };
  const { reports } = await listReports(scope);

  return (
    <AppShell
      role={session.role}
      roleLabel={ROLE_LABEL[session.role]}
      navItems={platformNavForSession(session)}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Reports"
        title="Cross-tier reports"
        description="Run, download, and schedule cross-tier analytics reports."
        actions={
          <Link
            href="/admin/platform/reports/schedules"
            className="inline-flex h-11 items-center rounded-full border border-iw-border bg-iw-raised px-5 text-sm font-semibold"
          >
            Schedules
          </Link>
        }
      />
      <ReportCatalog reports={reports} basePath="/admin/platform/reports" />
    </AppShell>
  );
}

import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import { ReportRunner } from "@/components/admin/report-runner";
import { REPORT_CATALOG } from "@/lib/admin/school-ops";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ reportId: string }> };

export default async function Page({ params }: Params) {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  const { reportId } = await params;
  const schoolId = session.tenantId ?? "t_school_demo";

  const report = REPORT_CATALOG.find((r) => r.id === reportId);
  if (!report) notFound();

  return (
    <AppShell
      role={session.role}
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="School admin · Reports"
        title={report.name}
        description={report.description}
      />
      <ReportRunner report={report} schoolId={schoolId} />
    </AppShell>
  );
}

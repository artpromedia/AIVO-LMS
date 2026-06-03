import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { getReportSchema } from "@/lib/services/reports-svc";
import { ReportParamForm } from "@/components/admin/reports/ReportParamForm";
import { ScheduleEditor } from "@/components/admin/reports/ScheduleEditor";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePageRole(["platform_admin"]);
  const { id } = await params;
  const scope = { role: session.role, tenantId: session.tenantId, actorId: session.userId };
  const schema = await getReportSchema(id, scope);

  const shell = (children: React.ReactNode) => (
    <AppShell
      role={session.role}
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      {children}
    </AppShell>
  );

  if (!schema) {
    return shell(
      <>
        <PageHeader eyebrow="Platform · Reports" title="Report" />
        <EmptyState
          title="Report not found"
          description="No report exists with that id in your scope."
          action={
            <Link href="/admin/platform/reports" className="text-sm font-semibold text-iw-primary">
              Back to reports
            </Link>
          }
        />
      </>,
    );
  }

  return shell(
    <>
      <PageHeader
        eyebrow="Platform · Reports"
        title={schema.title}
        description={schema.description}
      />
      <Card className="p-[var(--aivo-density-card-pad)]">
        <p className="mb-4 font-iw-display text-lg font-semibold text-iw-ink">Run report</p>
        <ReportParamForm schema={schema} basePath="/admin/platform/reports" />
      </Card>

      <details className="mt-6">
        <summary className="cursor-pointer font-iw-display text-lg font-semibold text-iw-ink">
          Schedule this report
        </summary>
        <Card className="mt-3 p-[var(--aivo-density-card-pad)]">
          <ScheduleEditor reportId={schema.id} schema={schema} />
        </Card>
      </details>
    </>,
  );
}

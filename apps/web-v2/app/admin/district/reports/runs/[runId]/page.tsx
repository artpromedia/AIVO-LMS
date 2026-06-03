import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import { getRun } from "@/lib/services/reports-svc";
import { RunStatusCard } from "@/components/admin/reports/RunStatusCard";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ runId: string }> }) {
  const session = await requirePageRole(["district_admin"]);
  const { runId } = await params;
  const scope = { role: session.role, tenantId: session.tenantId, actorId: session.userId };
  const run = await getRun(runId, scope);

  return (
    <AppShell
      role={session.role}
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District admin · Reports"
        title="Report run"
        description={`Run ${runId}`}
        actions={
          <Link
            href="/admin/district/reports"
            className="inline-flex h-11 items-center rounded-full border border-iw-border bg-iw-raised px-5 text-sm font-semibold"
          >
            Back to reports
          </Link>
        }
      />
      <RunStatusCard runId={runId} initialRun={run ?? undefined} />
    </AppShell>
  );
}

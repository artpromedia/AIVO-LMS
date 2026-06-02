import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import { getConnector, listRuns, latestRun, listErrors } from "@/lib/db/sis-store";
import { SyncStatusCard } from "@/components/admin/sis/SyncStatusCard";
import { RunHistoryTable } from "@/components/admin/sis/RunHistoryTable";
import { ErrorDrillDown } from "@/components/admin/sis/ErrorDrillDown";
import { RunControls } from "@/components/admin/sis/RunControls";
import { ConfigEditor } from "@/components/admin/sis/ConfigEditor";

export default async function Page({ params }: { params: Promise<{ connectorId: string }> }) {
  const session = await requirePageRole(["district_admin"]);
  const { connectorId } = await params;
  const t = await getTranslations("admin.sis");

  const connector = getConnector(connectorId);
  if (!connector) notFound();
  // Tenant isolation: a district admin may only view their own connectors.
  if (connector.tenantId !== session.tenantId) redirect("/admin/district/sis");

  const runs = listRuns(connectorId, 10);
  const { errors } = listErrors(connectorId);

  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Rostering"
        title={connector.displayName}
        description={t("detail_description")}
        actions={
          <Link href="/admin/district/sis" className="text-sm text-aivo-ink-soft hover:underline">
            ← {t("all_connectors")}
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-[var(--aivo-density-card-pad)]">
            <p className="mb-3 font-display text-lg font-semibold">{t("run_history")}</p>
            <RunControls connectorId={connector.id} />
            <div className="mt-4">
              <RunHistoryTable runs={runs} />
            </div>
          </Card>

          <Card className="p-[var(--aivo-density-card-pad)]">
            <p className="mb-3 font-display text-lg font-semibold">{t("errors")}</p>
            <ErrorDrillDown connectorId={connector.id} errors={errors} canRetry />
          </Card>

          <Card className="p-[var(--aivo-density-card-pad)]">
            <p className="mb-3 font-display text-lg font-semibold">{t("configuration")}</p>
            <ConfigEditor connector={connector} />
          </Card>
        </div>

        <div>
          <SyncStatusCard connector={connector} latestRun={latestRun(connector.id)} />
        </div>
      </div>
    </AppShell>
  );
}

import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { getTenantById } from "@/lib/db/repos";
import { listConnectors, latestRun } from "@/lib/db/sis-store";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.sis");
  const connectors = listConnectors();

  const rollup = connectors.reduce(
    (acc, c) => {
      const r = latestRun(c.id);
      if (r?.status === "paused") acc.paused += 1;
      else if (r?.status === "failed") acc.failed += 1;
      else if (r?.status === "success") acc.healthy += 1;
      acc.errors += r?.errorCount ?? 0;
      return acc;
    },
    { healthy: 0, paused: 0, failed: 0, errors: 0 },
  );

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Rostering"
        title={t("platform_title")}
        description={t("platform_description")}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-2xl font-semibold text-aivo-success">{rollup.healthy}</p>
          <p className="text-xs text-aivo-ink-soft">{t("stat_healthy")}</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-semibold text-aivo-warning">{rollup.paused}</p>
          <p className="text-xs text-aivo-ink-soft">{t("stat_paused")}</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-semibold text-aivo-danger">{rollup.failed}</p>
          <p className="text-xs text-aivo-ink-soft">{t("stat_failed")}</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-semibold">{rollup.errors}</p>
          <p className="text-xs text-aivo-ink-soft">{t("stat_errors")}</p>
        </Card>
      </div>

      {connectors.length === 0 ? (
        <EmptyState title={t("empty_title")} />
      ) : (
        <Card className="p-[var(--aivo-density-card-pad)]">
          <table className="w-full text-sm">
            <caption className="sr-only">{t("platform_title")}</caption>
            <thead>
              <tr className="text-left text-xs text-aivo-ink-soft">
                <th scope="col" className="py-1">
                  {t("col_district")}
                </th>
                <th scope="col">{t("col_connector")}</th>
                <th scope="col">{t("col_status")}</th>
                <th scope="col" className="text-right">
                  {t("col_last_sync")}
                </th>
              </tr>
            </thead>
            <tbody>
              {connectors.map((c) => {
                const r = latestRun(c.id);
                const tenant = getTenantById(c.tenantId);
                const tone =
                  r?.status === "success"
                    ? "success"
                    : r?.status === "paused"
                      ? "warning"
                      : r?.status === "failed"
                        ? "danger"
                        : "neutral";
                return (
                  <tr key={c.id} className="border-t border-aivo-border">
                    <td className="py-1">{tenant?.name ?? c.tenantId}</td>
                    <td>{c.displayName}</td>
                    <td>
                      <Badge tone={tone}>{r ? r.status : "never run"}</Badge>
                    </td>
                    <td className="text-right">
                      {r ? new Date(r.startedAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}

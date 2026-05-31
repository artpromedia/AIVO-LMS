import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import {
  computeSystemHealth,
  listAiGenerationJobs,
  scopeTenantsForSession,
  getTenantById,
} from "@/lib/db/repos";
import { getTranslations } from "next-intl/server";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  complete: "success",
  queued: "warning",
  running: "warning",
  failed: "danger",
};

export default async function Page() {
  const t = await getTranslations("admin.platform_ai_generation");
  const session = await requirePageRole(["platform_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const tenantIds = tenants.map((t) => t.id);
  const jobs = listAiGenerationJobs(tenantIds, 100);
  const health = computeSystemHealth(tenantIds);
  const summary = [
    { k: "Jobs", v: jobs.length.toLocaleString() },
    { k: "Success rate", v: `${Math.round(health.generationSuccessRate * 100)}%` },
    { k: "Failures", v: health.generationFailureCount.toLocaleString() },
    { k: "Queued", v: health.generationQueuedCount.toLocaleString() },
  ];

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · AI governance"
        title={t("title")}
        description="Live ledger of every LLM call the platform has made."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((s) => (
          <Card key={s.k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">{s.k}</p>
            <p className="mt-1 font-display text-3xl font-bold">{s.v}</p>
          </Card>
        ))}
      </div>
      <SectionHeader className="mt-8" title={t("recent_jobs")} description="Newest first." />
      {jobs.length === 0 ? (
        <EmptyState title={t("no_jobs_yet")} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Kind</th>
                <th className="p-3">{t("col_tenant")}</th>
                <th className="p-3">{t("col_status")}</th>
                <th className="p-3">{t("col_duration")}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-aivo-border">
                  <td className="p-3 text-aivo-ink-soft">
                    {new Date(j.startedAt).toLocaleString()}
                  </td>
                  <td className="p-3 font-medium">{j.kind}</td>
                  <td className="p-3 text-aivo-ink-soft">
                    {getTenantById(j.tenantId)?.name ?? j.tenantId}
                  </td>
                  <td className="p-3">
                    <Badge tone={STATUS_TONE[j.status] ?? "neutral"}>{j.status}</Badge>
                  </td>
                  <td className="p-3 text-aivo-ink-soft">
                    {j.completedAt
                      ? `${Math.max(0, Math.round((Date.parse(j.completedAt) - Date.parse(j.startedAt)) / 1000))}s`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}

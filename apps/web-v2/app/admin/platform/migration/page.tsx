import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listMigrationJobs } from "@/lib/db/repos";
import { RunForm } from "./run-form";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "primary"> = {
  completed: "success",
  failed: "danger",
  running: "primary",
  queued: "warning",
  dry_run: "neutral",
};

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.platform_migration");
  const jobs = listMigrationJobs();
  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Migration"
        title={t("title")}
        description="Preview and run data migrations from legacy systems. Always dry-run first."
      />
      <RunForm />

      <h2 className="mb-3 font-display text-lg font-semibold">{t("recent_jobs")}</h2>
      {jobs.length === 0 ? (
        <EmptyState
          title={t("empty")}
          description="Use the form above to start a dry-run."
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left">
              <tr>
                <th className="p-3">Job</th>
                <th className="p-3">{t("col_source")}</th>
                <th className="p-3">Kind</th>
                <th className="p-3">{t("col_status")}</th>
                <th className="p-3">{t("col_results")}</th>
                <th className="p-3">{t("col_started")}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-aivo-border">
                  <td className="p-3 font-mono text-xs">{j.id}</td>
                  <td className="p-3 text-aivo-ink-soft">{j.source}</td>
                  <td className="p-3 text-aivo-ink-soft">{j.kind}</td>
                  <td className="p-3">
                    <Badge tone={STATUS_TONE[j.status] ?? "neutral"}>{j.status}</Badge>
                    {j.dryRun ? (
                      <span className="ml-2 text-xs text-aivo-ink-soft">dry-run</span>
                    ) : null}
                  </td>
                  <td className="p-3 text-aivo-ink-soft">
                    {j.successRecords}/{j.totalRecords} ok
                    {j.failedRecords > 0 ? (
                      <span className="ml-1 text-aivo-danger">· {j.failedRecords} failed</span>
                    ) : null}
                    {j.skippedRecords > 0 ? (
                      <span className="ml-1">· {j.skippedRecords} skipped</span>
                    ) : null}
                  </td>
                  <td className="p-3 text-aivo-ink-soft">
                    {new Date(j.createdAt).toLocaleString()}
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

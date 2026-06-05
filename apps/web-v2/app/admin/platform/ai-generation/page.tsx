import { Permission } from "@aivo/security";
import { requirePlatformPage } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { platformNavForSession } from "@/components/layout/role-shells";
import { getPlatformSystemHealth, listRecentAiActivity } from "@/lib/admin-api/platform";
import { ROLE_LABEL } from "@/lib/auth/types";
import { getTranslations } from "next-intl/server";

export default async function Page() {
  const t = await getTranslations("admin.platform_ai_generation");
  const session = await requirePlatformPage(Permission.AiRead);
  const [health, entries] = await Promise.all([
    getPlatformSystemHealth(session),
    listRecentAiActivity(session, 100),
  ]);

  const byModel = entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.model] = (acc[entry.model] ?? 0) + 1;
    return acc;
  }, {});

  const summary = [
    { k: "Requests (24h)", v: health.aiRequests24h.toLocaleString() },
    { k: "Models active", v: health.aiModelsActive24h.toLocaleString() },
    { k: "Avg latency", v: `${health.aiAvgLatencyMs24h.toLocaleString()} ms` },
    { k: "Estimated cost", v: `$${health.aiEstimatedCostUsd24h.toFixed(2)}` },
  ];

  return (
    <AppShell
      role={session.role}
      roleLabel={ROLE_LABEL[session.role]}
      navItems={platformNavForSession(session)}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · AI governance"
        title={t("title")}
        description="Live ledger of recorded AI requests instead of in-memory generation fixtures."
        actions={<Badge tone="neutral">Live service data</Badge>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((item) => (
          <Card key={item.k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">{item.k}</p>
            <p className="mt-1 font-display text-3xl font-bold">{item.v}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">Model mix</p>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.entries(byModel)
              .sort((a, b) => b[1] - a[1])
              .map(([model, count]) => (
                <li key={model} className="flex items-center justify-between">
                  <span className="truncate pr-3 text-aivo-ink-soft">{model}</span>
                  <span className="font-semibold tabular-nums">{count.toLocaleString()}</span>
                </li>
              ))}
          </ul>
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)] lg:col-span-2">
          <p className="font-display text-lg font-semibold">Current posture</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-aivo-surface-2 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                Lessons completed
              </p>
              <p className="mt-1 font-display text-2xl font-bold">
                {health.lessonRunsCompleted.toLocaleString()}
              </p>
            </div>
            <div className="rounded-md bg-aivo-surface-2 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                Lessons total
              </p>
              <p className="mt-1 font-display text-2xl font-bold">
                {health.lessonRunsTotal.toLocaleString()}
              </p>
            </div>
            <div className="rounded-md bg-aivo-surface-2 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                Recent requests sampled
              </p>
              <p className="mt-1 font-display text-2xl font-bold">{entries.length.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      <SectionHeader className="mt-8" title={t("recent_jobs")} description="Newest first." />
      {entries.length === 0 ? (
        <EmptyState title={t("no_jobs_yet")} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Model</th>
                <th className="p-3">{t("col_tenant")}</th>
                <th className="p-3">{t("col_duration")}</th>
                <th className="p-3">Tokens</th>
                <th className="p-3">Cost</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-aivo-border">
                  <td className="p-3 text-aivo-ink-soft">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3 font-medium">
                    {entry.model}
                    <div className="text-xs text-aivo-ink-soft">{entry.provider}</div>
                  </td>
                  <td className="p-3 text-aivo-ink-soft">
                    {entry.tenantName ?? entry.tenantId ?? "Unknown"}
                  </td>
                  <td className="p-3 text-aivo-ink-soft">{entry.latencyMs.toLocaleString()} ms</td>
                  <td className="p-3 text-aivo-ink-soft">
                    {entry.inputTokens.toLocaleString()} in | {entry.outputTokens.toLocaleString()} out
                  </td>
                  <td className="p-3">${entry.estimatedCostUsd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}

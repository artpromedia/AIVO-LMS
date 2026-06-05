import { Permission } from "@aivo/security";
import { requirePlatformPage } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { platformNavForSession } from "@/components/layout/role-shells";
import { getPlatformSystemHealth, listRecentAiActivity } from "@/lib/admin-api/platform";
import { ROLE_LABEL } from "@/lib/auth/types";
import { Activity, Cpu, DollarSign, TimerReset } from "lucide-react";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

export default async function Page() {
  const session = await requirePlatformPage(Permission.AiRead);
  const t = await getTranslations("admin.platform_jobs");
  const [health, entries] = await Promise.all([
    getPlatformSystemHealth(session),
    listRecentAiActivity(session, 200),
  ]);

  const byProvider = entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.provider] = (acc[entry.provider] ?? 0) + 1;
    return acc;
  }, {});
  const medianLatency = median(entries.map((entry) => entry.latencyMs).filter((value) => value > 0));
  const totalTokens = entries.reduce(
    (sum, entry) => sum + entry.inputTokens + entry.outputTokens,
    0,
  );

  return (
    <AppShell
      role={session.role}
      roleLabel={ROLE_LABEL[session.role]}
      navItems={platformNavForSession(session)}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Jobs"
        title={t("title")}
        description="Live AI request ledger from admin-svc and ai_usage_log."
        actions={<Badge tone="neutral">Live service data</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Requests (24h)",
            value: health.aiRequests24h.toLocaleString(),
            helper: `${health.aiModelsActive24h} active models`,
            Icon: Activity,
          },
          {
            label: "Avg latency",
            value: `${health.aiAvgLatencyMs24h.toLocaleString()} ms`,
            helper: medianLatency === null ? "No recent samples" : `Median ${medianLatency} ms`,
            Icon: TimerReset,
          },
          {
            label: "Estimated cost (24h)",
            value: `$${health.aiEstimatedCostUsd24h.toFixed(2)}`,
            helper: `${entries.length.toLocaleString()} recent requests sampled`,
            Icon: DollarSign,
          },
          {
            label: "Tokens sampled",
            value: totalTokens.toLocaleString(),
            helper: `${health.lessonRunsCompleted.toLocaleString()} lessons completed`,
            Icon: Cpu,
          },
        ].map(({ label, value, helper, Icon }) => (
          <Card key={label} className="p-[var(--aivo-density-card-pad)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                  {label}
                </p>
                <p className="mt-1 font-display text-3xl font-bold">{value}</p>
                <p className="mt-2 text-xs text-aivo-ink-soft">{helper}</p>
              </div>
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-aivo-primary-soft text-aivo-primary"
              >
                <Icon className="h-4 w-4" />
              </span>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">Provider mix</p>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.entries(byProvider)
              .sort((a, b) => b[1] - a[1])
              .map(([provider, count]) => (
                <li key={provider} className="flex items-center justify-between">
                  <span className="text-aivo-ink-soft">{provider}</span>
                  <span className="font-semibold tabular-nums">{count.toLocaleString()}</span>
                </li>
              ))}
          </ul>
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">AI operations</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-aivo-ink-soft">Models active</span>
              <span className="font-semibold">{health.aiModelsActive24h}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-aivo-ink-soft">Requests last 24h</span>
              <span className="font-semibold">{health.aiRequests24h.toLocaleString()}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-aivo-ink-soft">Lessons completed</span>
              <span className="font-semibold">{health.lessonRunsCompleted.toLocaleString()}</span>
            </li>
          </ul>
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">Latency</p>
          <p className="mt-1 text-xs text-aivo-ink-soft">
            Based on the most recent {entries.length.toLocaleString()} recorded AI requests.
          </p>
          <p className="mt-3 font-display text-3xl font-bold">
            {medianLatency === null ? "\u2014" : `${medianLatency} ms`}
          </p>
          <p className="mt-1 text-xs text-aivo-ink-soft">
            Average {health.aiAvgLatencyMs24h.toLocaleString()} ms across the last 24 hours
          </p>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-aivo-border px-4 py-3 text-sm font-medium">
          Recent AI requests
        </div>
        {entries.length === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-aivo-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                <tr>
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Model</th>
                  <th className="px-4 py-2">{t("col_tenant")}</th>
                  <th className="px-4 py-2">Tokens</th>
                  <th className="px-4 py-2 text-right">Latency</th>
                  <th className="px-4 py-2 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aivo-border">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <div>{entry.model}</div>
                      <div className="text-xs text-aivo-ink-soft">{entry.provider}</div>
                    </td>
                    <td className="px-4 py-3 text-aivo-ink-soft">
                      {entry.tenantName ?? entry.tenantId ?? "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-aivo-ink-soft">
                      {entry.inputTokens.toLocaleString()} in | {entry.outputTokens.toLocaleString()} out
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-aivo-ink-soft">
                      {entry.latencyMs.toLocaleString()} ms
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      ${entry.estimatedCostUsd.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  );
}

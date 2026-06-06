import { Permission } from "@aivo/security";
import { requirePlatformPage } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { platformNavForSession } from "@/components/layout/role-shells";
import { getPlatformAiCosts } from "@aivo/admin-api/platform";
import { ROLE_LABEL } from "@/lib/auth/types";
import { getTranslations } from "next-intl/server";

function fmtUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function fmtBudgetCap(value: number | null): string {
  return value === null ? "\u2014" : `$${value.toFixed(2)}`;
}

export default async function Page() {
  const t = await getTranslations("admin.platform_ai_costs");
  const session = await requirePlatformPage(Permission.AiRead);
  const snapshot = await getPlatformAiCosts(session, 50);

  return (
    <AppShell
      role={session.role}
      roleLabel={ROLE_LABEL[session.role]}
      navItems={platformNavForSession(session)}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · AI costs"
        title={t("title")}
        description="Real 24-hour AI usage spend plus live daily budget state from ai-svc."
        actions={<Badge tone="neutral">Live service data</Badge>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            Spend (24h)
          </p>
          <p className="mt-1 font-display text-3xl font-bold">
            {fmtUsd(snapshot.summary.totalEstimatedCostUsd24h)}
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            Active tenants
          </p>
          <p className="mt-1 font-display text-3xl font-bold">
            {snapshot.summary.activeTenants24h.toLocaleString()}
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            Warned budgets
          </p>
          <p className="mt-1 font-display text-3xl font-bold">
            {snapshot.summary.warningTenants.toLocaleString()}
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            Over cap
          </p>
          <p className="mt-1 font-display text-3xl font-bold">
            {snapshot.summary.overCapTenants.toLocaleString()}
          </p>
        </Card>
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold">Tenants</h2>
      <Card className="mb-8 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-aivo-surface-2 text-left">
            <tr>
              <th className="p-3">{t("col_tenant")}</th>
              <th className="p-3">Requests (24h)</th>
              <th className="p-3">Spend (24h)</th>
              <th className="p-3">{t("col_status")}</th>
              <th className="p-3">Daily cap</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.tenants.map((tenant) => {
              const tone: "neutral" | "warning" | "danger" | "success" = !tenant.budget.budgetAvailable
                ? "neutral"
                : tenant.budget.exceeded
                  ? "danger"
                  : tenant.budget.warned
                    ? "warning"
                    : "success";
              const label = !tenant.budget.budgetAvailable
                ? "budget unavailable"
                : tenant.budget.exceeded
                  ? "over cap"
                  : tenant.budget.warned
                    ? "warning"
                    : "ok";
              return (
                <tr key={tenant.tenantId} className="border-t border-aivo-border">
                  <td className="p-3 font-medium">
                    {tenant.tenantName ?? tenant.tenantId}
                    <span className="ml-2 text-xs text-aivo-ink-soft">{tenant.tenantTypeLabel}</span>
                  </td>
                  <td className="p-3 text-aivo-ink-soft">{tenant.requestCount24h.toLocaleString()}</td>
                  <td className="p-3">
                    {fmtUsd(tenant.estimatedCostUsd24h)}
                    <span className="ml-1 text-xs text-aivo-ink-soft">
                      {tenant.inputTokens24h.toLocaleString()} in | {tenant.outputTokens24h.toLocaleString()} out
                    </span>
                  </td>
                  <td className="p-3">
                    <Badge tone={tone}>{label}</Badge>
                    {tenant.budget.error ? (
                      <div className="mt-1 text-xs text-aivo-ink-soft">{tenant.budget.error}</div>
                    ) : null}
                  </td>
                  <td className="p-3 text-aivo-ink-soft">
                    {fmtBudgetCap(tenant.budget.capUsd)}
                    {tenant.budget.budgetAvailable ? (
                      <div className="text-xs">
                        spend {fmtUsd(tenant.budget.spendUsd ?? 0)} | warn{" "}
                        {fmtBudgetCap(tenant.budget.warnUsd)}
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <h2 className="mb-3 font-display text-lg font-semibold">{t("recent_cost_events")}</h2>
      {snapshot.events.length === 0 ? (
        <EmptyState
          title={t("no_cost_events_yet")}
          description="Recorded AI requests will appear here as they run."
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">{t("col_tenant")}</th>
                <th className="p-3">{t("col_provider_model")}</th>
                <th className="p-3">{t("col_tokens")}</th>
                <th className="p-3">Latency</th>
                <th className="p-3">Cost</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.events.map((event) => (
                <tr key={event.id} className="border-t border-aivo-border">
                  <td className="p-3 text-aivo-ink-soft">
                    {new Date(event.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3 font-medium">
                    {event.tenantName ?? event.tenantId ?? "Unknown"}
                  </td>
                  <td className="p-3 text-aivo-ink-soft">
                    {event.provider} | {event.model}
                  </td>
                  <td className="p-3 text-aivo-ink-soft">
                    {event.inputTokens.toLocaleString()} in | {event.outputTokens.toLocaleString()} out
                  </td>
                  <td className="p-3 text-aivo-ink-soft">{event.latencyMs.toLocaleString()} ms</td>
                  <td className="p-3">{fmtUsd(event.estimatedCostUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}

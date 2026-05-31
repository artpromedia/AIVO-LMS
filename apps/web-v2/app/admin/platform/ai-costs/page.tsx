import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import {
  checkAIBudget,
  getAIBudget,
  listAICostEvents,
  monthToDateSpendCents,
  scopeTenantsForSession,
} from "@/lib/db/repos";
import { BudgetEditor } from "./budget-editor";
import { getTranslations } from "next-intl/server";

function fmtCents(c: number): string {
  return `$${(c / 100).toFixed(2)}`;
}

export default async function Page() {
  const t = await getTranslations("admin.platform_ai_costs");
  const session = await requirePageRole(["platform_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const rows = tenants.map((t) => ({
    tenant: t,
    budget: getAIBudget(t.id),
    spent: monthToDateSpendCents(t.id),
    check: checkAIBudget(t.id),
  }));
  const events = listAICostEvents({ limit: 50 });
  const tenantsById = new Map(tenants.map((t) => [t.id, t]));

  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const overBudget = rows.filter(
    (r) => r.budget.monthlyCapCents !== null && r.spent >= r.budget.monthlyCapCents,
  ).length;
  const warning = rows.filter((r) => r.check.warning && r.check.allow).length;

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · AI costs"
        title={t("title")}
        description="Per-tenant LLM and TTS spend, with monthly caps and hard stops."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            {t("spend_mtd")}
          </p>
          <p className="mt-1 font-display text-3xl font-bold">{fmtCents(totalSpent)}</p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            {t("approaching_cap")}
          </p>
          <p className="mt-1 font-display text-3xl font-bold">{warning}</p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">{t("over_cap")}</p>
          <p className="mt-1 font-display text-3xl font-bold">{overBudget}</p>
        </Card>
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold">{t("tenants")}</h2>
      <Card className="mb-8 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-aivo-surface-2 text-left">
            <tr>
              <th className="p-3">{t("col_tenant")}</th>
              <th className="p-3">Spend</th>
              <th className="p-3">{t("col_status")}</th>
              <th className="p-3">{t("col_budget")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const ratio =
                r.budget.monthlyCapCents === null
                  ? 0
                  : r.budget.monthlyCapCents === 0
                    ? 1
                    : r.spent / r.budget.monthlyCapCents;
              const tone: "neutral" | "warning" | "danger" | "success" = !r.check.allow
                ? "danger"
                : r.check.warning
                  ? "warning"
                  : r.budget.monthlyCapCents === null
                    ? "neutral"
                    : "success";
              return (
                <tr key={r.tenant.id} className="border-t border-aivo-border">
                  <td className="p-3 font-medium">
                    {r.tenant.name}
                    <span className="ml-2 text-xs text-aivo-ink-soft">{r.tenant.type}</span>
                  </td>
                  <td className="p-3">
                    {fmtCents(r.spent)}
                    {r.budget.monthlyCapCents !== null ? (
                      <span className="ml-1 text-xs text-aivo-ink-soft">
                        / {fmtCents(r.budget.monthlyCapCents)} ({Math.round(ratio * 100)}%)
                      </span>
                    ) : (
                      <span className="ml-1 text-xs text-aivo-ink-soft">/ unlimited</span>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge tone={tone}>
                      {!r.check.allow
                        ? "blocked"
                        : r.check.warning
                          ? "approaching"
                          : r.budget.monthlyCapCents === null
                            ? "unlimited"
                            : "ok"}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <BudgetEditor
                      tenantId={r.tenant.id}
                      monthlyCapCents={r.budget.monthlyCapCents}
                      warnAt={r.budget.warnAt}
                      hardStop={r.budget.hardStop}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <h2 className="mb-3 font-display text-lg font-semibold">{t("recent_cost_events")}</h2>
      {events.length === 0 ? (
        <EmptyState
          title={t("no_cost_events_yet")}
          description="AI generations will appear here as they run."
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">{t("col_tenant")}</th>
                <th className="p-3">{t("col_feature")}</th>
                <th className="p-3">{t("col_provider_model")}</th>
                <th className="p-3">{t("col_tokens")}</th>
                <th className="p-3">Cost</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-aivo-border">
                  <td className="p-3 text-aivo-ink-soft">
                    {new Date(e.occurredAt).toLocaleString()}
                  </td>
                  <td className="p-3 font-medium">
                    {tenantsById.get(e.tenantId)?.name ?? e.tenantId}
                  </td>
                  <td className="p-3 text-aivo-ink-soft">{e.feature}</td>
                  <td className="p-3 text-aivo-ink-soft">
                    {e.provider} · {e.model}
                  </td>
                  <td className="p-3 text-aivo-ink-soft">
                    {e.promptTokens.toLocaleString()} → {e.completionTokens.toLocaleString()}
                  </td>
                  <td className="p-3">{fmtCents(e.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}

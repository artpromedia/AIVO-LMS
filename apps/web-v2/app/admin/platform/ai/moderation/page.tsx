import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listModerationEvents, scopeTenantsForSession, getTenantById } from "@/lib/db/repos";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

function decisionTone(d: "allow" | "review" | "block"): "success" | "warning" | "danger" {
  return d === "block" ? "danger" : d === "review" ? "warning" : "success";
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default async function Page() {
  const t = await getTranslations("admin.platform_ai_moderation");
  const session = await requirePageRole(["platform_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const tenantIds = new Set(tenants.map((t) => t.id));
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  const all = listModerationEvents({ limit: 500 }).filter((e) => tenantIds.has(e.tenantId));

  const reviewed = all.filter((e) => e.classification.decision === "review");
  const blocked = all.filter((e) => e.classification.decision === "block");
  const allowed = all.filter((e) => e.classification.decision === "allow");
  const injectionFlagged = all.filter((e) => e.injectionSignals.length > 0).length;
  const crisisFlagged = all.filter((e) => e.crisisSignals.length > 0).length;
  const cutoff24h = Date.now() - 24 * 3600_000;
  const last24h = all.filter((e) => new Date(e.createdAt).getTime() > cutoff24h).length;

  // Category mix from blocked/review events (allow events typically lack categories).
  const categoryCount = new Map<string, number>();
  for (const e of all) {
    if (e.classification.decision === "allow") continue;
    for (const c of e.classification.categories ?? []) {
      categoryCount.set(c, (categoryCount.get(c) ?? 0) + 1);
    }
  }
  const topCategories = [...categoryCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const stats = [
    { k: "All events", v: all.length.toLocaleString() },
    { k: "Blocked", v: blocked.length.toLocaleString() },
    { k: "Review", v: reviewed.length.toLocaleString() },
    { k: "Allowed", v: allowed.length.toLocaleString() },
    { k: "Last 24h", v: last24h.toLocaleString() },
    { k: "Injection signals", v: injectionFlagged.toLocaleString() },
    { k: "Crisis signals", v: crisisFlagged.toLocaleString() },
  ];

  // Show blocked + review first; cap at 100.
  const focus = [...blocked, ...reviewed]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · AI"
        title={t("title")}
        description="Every classification produced by the safety pipeline. Allow decisions are recorded only at debug volume; the table below focuses on block + review."
      />

      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
        {stats.map((s) => (
          <Card key={s.k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs uppercase tracking-wide text-aivo-ink-soft">{s.k}</p>
            <p className="mt-2 font-display text-2xl font-semibold">{s.v}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)] lg:col-span-1">
          <p className="font-display text-lg font-semibold">{t("top_categories")}</p>
          {topCategories.length === 0 ? (
            <p className="mt-2 text-sm text-aivo-ink-soft">{t("no_categorised_events")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {topCategories.map(([cat, count]) => (
                <li key={cat} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{cat.replace(/_/g, " ")}</span>
                  <span className="tabular-nums text-aivo-ink-soft">{count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden p-0 lg:col-span-2">
          {focus.length === 0 ? (
            <EmptyState
              title={t("no_block_or_review_events")}
              description="The safety pipeline allowed every recent classification."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-aivo-surface-2 text-xs uppercase tracking-wide text-aivo-ink-soft">
                <tr>
                  <th className="px-4 py-3 text-left">When</th>
                  <th className="px-4 py-3 text-left">{t("col_tenant")}</th>
                  <th className="px-4 py-3 text-left">{t("col_decision")}</th>
                  <th className="px-4 py-3 text-left">{t("col_categories")}</th>
                  <th className="px-4 py-3 text-left">{t("col_signals")}</th>
                  <th className="px-4 py-3 text-left">{t("col_excerpt")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aivo-border">
                {focus.map((e) => {
                  const tenant = tenantById.get(e.tenantId) ?? getTenantById(e.tenantId);
                  return (
                    <tr key={e.id} className="hover:bg-aivo-surface-2/40">
                      <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                        {relativeTime(e.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-xs">{tenant?.name ?? e.tenantId}</td>
                      <td className="px-4 py-3">
                        <Badge tone={decisionTone(e.classification.decision)}>
                          {e.classification.decision}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {e.classification.categories?.join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {e.injectionSignals.length > 0 ? (
                          <Badge tone="warning">injection ×{e.injectionSignals.length}</Badge>
                        ) : null}{" "}
                        {e.crisisSignals.length > 0 ? (
                          <Badge tone="danger">crisis ×{e.crisisSignals.length}</Badge>
                        ) : null}
                        {e.injectionSignals.length === 0 && e.crisisSignals.length === 0
                          ? "—"
                          : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-aivo-ink-soft" title={e.excerpt}>
                        {e.excerpt.length > 80 ? `${e.excerpt.slice(0, 80)}…` : e.excerpt}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

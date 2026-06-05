import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { getModerationStats, listModerationEvents } from "@/lib/admin-api/moderation";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

function statusTone(status: string): "success" | "warning" | "danger" | "primary" | "neutral" {
  if (status === "REJECTED") return "danger";
  if (status === "PENDING" || status === "LOW_CONFIDENCE") return "warning";
  if (status === "ESCALATED") return "primary";
  if (status === "APPROVED") return "success";
  return "neutral";
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
  const [events, stats] = await Promise.all([
    listModerationEvents(session, { perPage: 200 }),
    getModerationStats(session),
  ]);

  const statusCounts = new Map(stats.byStatus.map((row) => [row.status, row.count]));
  const last24h = events.filter(
    (event) => new Date(event.createdAt).getTime() > Date.now() - 24 * 3600_000,
  ).length;

  const statTiles = [
    { k: "All events", v: events.length.toLocaleString() },
    { k: "Pending", v: (statusCounts.get("PENDING") ?? 0).toLocaleString() },
    { k: "Rejected", v: (statusCounts.get("REJECTED") ?? 0).toLocaleString() },
    { k: "Escalated", v: (statusCounts.get("ESCALATED") ?? 0).toLocaleString() },
    { k: "Approved", v: (statusCounts.get("APPROVED") ?? 0).toLocaleString() },
    { k: "Last 24h", v: last24h.toLocaleString() },
  ];

  const focus = events
    .filter((event) => event.status !== "APPROVED")
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
        eyebrow="Platform | AI"
        title={t("title")}
        description="Moderation records from admin-svc, focused on pending, rejected, and escalated content."
      />

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {statTiles.map((tile) => (
          <Card key={tile.k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs uppercase tracking-wide text-aivo-ink-soft">{tile.k}</p>
            <p className="mt-2 font-display text-2xl font-semibold">{tile.v}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">{t("top_categories")}</p>
          {stats.byReason.length === 0 ? (
            <p className="mt-2 text-sm text-aivo-ink-soft">{t("no_categorised_events")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {stats.byReason.slice(0, 5).map((row) => (
                <li key={row.reason} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{row.reason.replace(/_/g, " ")}</span>
                  <span className="tabular-nums text-aivo-ink-soft">{row.count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden p-0 lg:col-span-2">
          {focus.length === 0 ? (
            <EmptyState
              title={t("no_block_or_review_events")}
              description="There are no non-approved moderation records in the current service response."
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
                {focus.map((event) => (
                  <tr key={event.id} className="hover:bg-aivo-surface-2/40">
                    <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                      {relativeTime(event.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-xs">{event.tenantId ?? "unknown"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(event.status)}>{event.status.toLowerCase()}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">{event.flagReason.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-xs">
                      {event.tutorSku ? <Badge tone="neutral">{event.tutorSku}</Badge> : "none"}
                    </td>
                    <td className="px-4 py-3 text-xs text-aivo-ink-soft" title={event.content}>
                      {event.content.length > 80 ? `${event.content.slice(0, 80)}...` : event.content}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

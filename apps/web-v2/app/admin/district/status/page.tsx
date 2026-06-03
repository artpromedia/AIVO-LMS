import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getPublicSummary, getTenantHealth } from "@/lib/services/status-page-svc";
import { ComponentMatrix } from "@/components/admin/status/ComponentMatrix";

export const dynamic = "force-dynamic";

function impactTone(impact: string): "warning" | "danger" | "neutral" {
  if (impact === "critical" || impact === "major") return "danger";
  if (impact === "minor") return "warning";
  return "neutral";
}

function healthTone(status: string): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "healthy":
    case "operational":
      return "success";
    case "at_risk":
    case "degraded":
      return "warning";
    case "breaching":
    case "down":
      return "danger";
    default:
      return "neutral";
  }
}

function pct(n: unknown): string {
  return typeof n === "number" ? `${(n * 100).toFixed(2)}%` : "—";
}

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  const summary = await getPublicSummary(session.tenantId);
  const health = await getTenantHealth(session.tenantId);

  return (
    <AppShell
      role={session.role}
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District · Reliability"
        title="Service status"
        description="Health of the services your district relies on, plus any active incidents that affect you."
        actions={<Badge tone={healthTone(health.overall)}>
          <span className="capitalize">{String(health.overall).replace(/_/g, " ")}</span>
        </Badge>}
      />

      <Card className="p-[var(--aivo-density-card-pad)]">
        <p className="mb-4 font-iw-display text-lg font-semibold text-iw-ink">Components</p>
        <ComponentMatrix components={summary.components} />
      </Card>

      <Card className="mt-6 overflow-hidden p-0">
        <div className="border-b border-iw-border p-[var(--aivo-density-card-pad)]">
          <p className="font-iw-display text-lg font-semibold text-iw-ink">Health signals</p>
        </div>
        {(!health.signals || health.signals.length === 0) ? (
          <EmptyState
            title="No signals"
            description="No tenant-scoped health signals are currently reported."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-iw-card-soft text-xs uppercase tracking-wide text-iw-ink-muted">
              <tr>
                <th className="px-4 py-3 text-left">Service</th>
                <th className="px-4 py-3 text-left">Observed SLI</th>
                <th className="px-4 py-3 text-left">Target</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-iw-border">
              {health.signals.map((s: any, i: number) => (
                <tr key={s.service ?? i} className="hover:bg-iw-card-soft/40">
                  <td className="px-4 py-3 text-iw-ink">{s.service ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{pct(s.observedSli)}</td>
                  <td className="px-4 py-3 tabular-nums">{pct(s.target)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={healthTone(s.status)}>
                      <span className="capitalize">{String(s.status ?? "").replace(/_/g, " ")}</span>
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="mt-6 p-[var(--aivo-density-card-pad)]">
        <p className="mb-4 font-iw-display text-lg font-semibold text-iw-ink">
          Active incidents
        </p>
        {summary.activeIncidents.length === 0 ? (
          <p className="text-sm text-iw-ink-muted">No active incidents affecting your district.</p>
        ) : (
          <ul className="space-y-3">
            {summary.activeIncidents.map((inc) => (
              <li
                key={inc.id}
                className="rounded-iw-card border border-iw-border bg-iw-card px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-iw-ink">{inc.title}</p>
                  <Badge tone={impactTone(inc.impact)}>
                    <span className="capitalize">{inc.impact}</span>
                  </Badge>
                </div>
                <p className="mt-1 text-xs capitalize text-iw-ink-muted">
                  {inc.lifecycle.replace(/_/g, " ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}

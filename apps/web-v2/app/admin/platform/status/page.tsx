import Link from "next/link";
import { Permission } from "@aivo/security";
import { requirePlatformPage } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { platformNavForSession } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ROLE_LABEL } from "@/lib/auth/types";
import {
  getPublicSummary,
  listComponents,
  listIncidents,
  listMaintenances,
  getBudgets,
} from "@/lib/services/status-page-svc";
import { ComponentMatrix } from "@/components/admin/status/ComponentMatrix";
import { SloCard } from "@/components/admin/status/SloCard";
import { BudgetBurnChart } from "@/components/admin/status/BudgetBurnChart";
import { MaintenanceCalendar } from "@/components/admin/status/MaintenanceCalendar";

export const dynamic = "force-dynamic";

function impactTone(impact?: string): "warning" | "danger" | "neutral" {
  if (impact === "critical" || impact === "major") return "danger";
  if (impact === "minor") return "warning";
  return "neutral";
}

function lifecycleTone(lc?: string): "primary" | "warning" | "success" | "neutral" {
  switch (lc) {
    case "resolved":
      return "success";
    case "monitoring":
      return "primary";
    case "investigating":
    case "identified":
      return "warning";
    default:
      return "neutral";
  }
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function Page() {
  const session = await requirePlatformPage(Permission.PlatformRead);
  const summary = await getPublicSummary();
  const components = await listComponents();
  const incidents = await listIncidents();
  const maintenances = await listMaintenances();
  const budgets = await getBudgets();

  return (
    <AppShell
      role={session.role}
      roleLabel={ROLE_LABEL[session.role]}
      navItems={platformNavForSession(session)}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Reliability"
        title="Status & SLOs"
        description="Global service health, error-budget burn, incidents, and scheduled maintenance."
        actions={
          <>
            <Link
              href="/admin/platform/status/incidents/new"
              className="rounded-iw-card bg-iw-primary px-4 py-2 text-sm font-semibold text-white"
            >
              New incident
            </Link>
            <Link
              href="/admin/platform/status/maintenance"
              className="rounded-iw-card border border-iw-border px-4 py-2 text-sm font-semibold text-iw-ink"
            >
              Maintenance
            </Link>
          </>
        }
      />

      <Card className="p-[var(--aivo-density-card-pad)]">
        <p className="mb-4 font-iw-display text-lg font-semibold text-iw-ink">Components</p>
        <ComponentMatrix components={components} />
      </Card>

      <section className="mt-6">
        <p className="mb-3 font-iw-display text-lg font-semibold text-iw-ink">
          Service-level objectives
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((b) => (
            <SloCard key={b.sloId} budget={b} />
          ))}
        </div>
        <div className="mt-4">
          <BudgetBurnChart budgets={budgets} />
        </div>
      </section>

      <Card className="mt-6 overflow-hidden p-0">
        <div className="border-b border-iw-border p-[var(--aivo-density-card-pad)]">
          <p className="font-iw-display text-lg font-semibold text-iw-ink">Incidents</p>
        </div>
        {incidents.length === 0 ? (
          <EmptyState title="No incidents" description="No incidents have been reported." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-iw-card-soft text-xs uppercase tracking-wide text-iw-ink-muted">
              <tr>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Impact</th>
                <th className="px-4 py-3 text-left">Lifecycle</th>
                <th className="px-4 py-3 text-left">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-iw-border">
              {incidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-iw-card-soft/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/platform/status/incidents/${inc.id}`}
                      className="font-medium text-iw-primary underline"
                    >
                      {inc.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={impactTone(inc.impact)}>
                      <span className="capitalize">{inc.impact}</span>
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={lifecycleTone(inc.lifecycle)}>
                      <span className="capitalize">
                        {String(inc.lifecycle ?? "").replace(/_/g, " ")}
                      </span>
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-iw-ink-muted">
                    {fmt(inc.updatedAt ?? null)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="mt-6 p-[var(--aivo-density-card-pad)]">
        <p className="mb-4 font-iw-display text-lg font-semibold text-iw-ink">
          Scheduled maintenance
        </p>
        <MaintenanceCalendar maintenances={maintenances} />
      </Card>

      {/* summary kept available for future overall-status surfacing */}
      <p className="mt-6 text-xs text-iw-ink-muted">
        Overall status: <span className="capitalize">{summary.overall.replace(/_/g, " ")}</span>
      </p>
    </AppShell>
  );
}

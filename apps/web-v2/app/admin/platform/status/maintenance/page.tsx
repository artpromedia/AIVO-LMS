import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { listMaintenances } from "@/lib/services/status-page-svc";
import { MaintenanceCalendar } from "@/components/admin/status/MaintenanceCalendar";

export const dynamic = "force-dynamic";

function stateTone(state: string): "primary" | "warning" | "neutral" {
  if (state === "in_progress") return "warning";
  if (state === "scheduled" || state === "upcoming") return "primary";
  return "neutral";
}

function fmt(iso: string): string {
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
  const session = await requirePageRole(["platform_admin"]);
  const maintenances = await listMaintenances();

  return (
    <AppShell
      role={session.role}
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Reliability"
        title="Scheduled maintenance"
        description="Maintenance windows are scheduled at the platform level and surface on the public status page and tenant health views."
      />

      <Card className="p-[var(--aivo-density-card-pad)]">
        <p className="mb-4 font-iw-display text-lg font-semibold text-iw-ink">Calendar</p>
        <MaintenanceCalendar maintenances={maintenances} />
      </Card>

      <Card className="mt-6 overflow-hidden p-0">
        <div className="border-b border-iw-border p-[var(--aivo-density-card-pad)]">
          <p className="font-iw-display text-lg font-semibold text-iw-ink">All windows</p>
        </div>
        {maintenances.length === 0 ? (
          <EmptyState
            title="No scheduled maintenance"
            description="There are no maintenance windows scheduled."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-iw-card-soft text-xs uppercase tracking-wide text-iw-ink-muted">
              <tr>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">State</th>
                <th className="px-4 py-3 text-left">Start</th>
                <th className="px-4 py-3 text-left">End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-iw-border">
              {maintenances.map((m) => (
                <tr key={m.id} className="hover:bg-iw-card-soft/40">
                  <td className="px-4 py-3 text-iw-ink">{m.title}</td>
                  <td className="px-4 py-3">
                    <Badge tone={stateTone(m.state)}>
                      <span className="capitalize">{String(m.state).replace(/_/g, " ")}</span>
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-iw-ink-muted">{fmt(m.scheduledStart)}</td>
                  <td className="px-4 py-3 text-xs text-iw-ink-muted">{fmt(m.scheduledEnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>
  );
}

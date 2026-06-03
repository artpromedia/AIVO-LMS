import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPublicSummary, getTenantHealth } from "@/lib/services/status-page-svc";
import { ComponentMatrix } from "@/components/admin/status/ComponentMatrix";

export const dynamic = "force-dynamic";

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

export default async function Page() {
  const session = await requirePageRole(["school_admin"]);
  const health = await getTenantHealth(session.tenantId);
  const summary = await getPublicSummary(session.tenantId);

  const signalCount = health.signals?.length ?? 0;
  const activeCount = summary.activeIncidents.length;

  return (
    <AppShell
      role={session.role}
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="School · Reliability"
        title="Service status"
        description="A read-only view of the health of the services your school uses."
      />

      <Card className="p-[var(--aivo-density-card-pad)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-iw-display text-base font-semibold text-iw-ink">Overall health</p>
            <p className="mt-1 text-sm text-iw-ink-muted">
              {activeCount > 0
                ? `${activeCount} active incident${activeCount === 1 ? "" : "s"} may affect your school.`
                : "No active incidents affecting your school."}
            </p>
          </div>
          <Badge tone={healthTone(health.overall)}>
            <span className="capitalize">{String(health.overall).replace(/_/g, " ")}</span>
          </Badge>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-iw-ink-muted">Components</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{summary.components.length}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-iw-ink-muted">Health signals</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{signalCount}</dd>
          </div>
        </dl>
      </Card>

      <Card className="mt-6 p-[var(--aivo-density-card-pad)]">
        <p className="mb-4 font-iw-display text-lg font-semibold text-iw-ink">Components</p>
        <ComponentMatrix components={summary.components} />
      </Card>

      <p className="mt-4 text-xs text-iw-ink-muted">
        This page is read-only. Incident management and maintenance scheduling are handled by the
        platform team.
      </p>
    </AppShell>
  );
}

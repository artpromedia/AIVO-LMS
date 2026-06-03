import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listIncidents } from "@/lib/services/responsible-ai-svc";
import { IncidentTimeline } from "@/components/admin/ai/IncidentTimeline";

export const dynamic = "force-dynamic";

function severityTone(s: string): "danger" | "warning" | "neutral" {
  if (s === "critical" || s === "high") return "danger";
  if (s === "medium") return "warning";
  return "neutral";
}

function stateTone(s: string): "success" | "warning" | "neutral" {
  if (s === "resolved" || s === "closed") return "success";
  if (s === "investigating" || s === "open") return "warning";
  return "neutral";
}

export default async function Page({ params }: { params: { id: string } }) {
  const session = await requirePageRole(["platform_admin"]);
  const incident = (await listIncidents()).find((i) => i.id === params.id) ?? null;

  return (
    <AppShell
      role={session.role}
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Responsible AI"
        title={incident?.title ?? "Incident"}
        actions={
          <Link
            href="/admin/platform/ai/incidents"
            className="inline-flex h-11 items-center rounded-full border border-iw-border bg-iw-raised px-5 text-sm font-semibold"
          >
            Back to incidents
          </Link>
        }
      />

      {!incident ? (
        <EmptyState title="Incident not found" description="No incident exists with that id." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-[var(--aivo-density-card-pad)] lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={severityTone(incident.severity)}>{incident.severity}</Badge>
              <Badge tone={stateTone(incident.state)}>{incident.state}</Badge>
            </div>
            <p className="mt-4 text-sm">{incident.description}</p>

            <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <dt className="text-aivo-ink-soft">Reported by</dt>
              <dd>{incident.reportedByRole}</dd>
              <dt className="text-aivo-ink-soft">Model</dt>
              <dd>{incident.modelId ?? "—"}</dd>
              <dt className="text-aivo-ink-soft">Tenant</dt>
              <dd>{incident.tenantId ?? "—"}</dd>
              <dt className="text-aivo-ink-soft">Created</dt>
              <dd>{new Date(incident.createdAt).toLocaleString()}</dd>
              <dt className="text-aivo-ink-soft">Updated</dt>
              <dd>{new Date(incident.updatedAt).toLocaleString()}</dd>
            </dl>
          </Card>

          <Card className="p-[var(--aivo-density-card-pad)]">
            <p className="font-display text-lg font-semibold">Timeline</p>
            <div className="mt-4">
              <IncidentTimeline timeline={incident.timeline} />
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

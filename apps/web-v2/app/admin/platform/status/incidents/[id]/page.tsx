import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getIncident } from "@/lib/services/status-page-svc";
import { IncidentTimeline } from "@/components/admin/status/IncidentTimeline";
import { IncidentLifecycleControls } from "./incident-lifecycle-controls";

export const dynamic = "force-dynamic";

function impactTone(impact: string): "warning" | "danger" | "neutral" {
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

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePageRole(["platform_admin"]);
  const { id } = await params;
  const data = await getIncident(id);

  return (
    <AppShell
      role={session.role}
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      {!data ? (
        <>
          <PageHeader eyebrow="Platform · Reliability" title="Incident" />
          <EmptyState
            title="Incident not found"
            description="This incident does not exist or is no longer available."
          />
        </>
      ) : (
        <>
          <PageHeader
            eyebrow="Platform · Reliability"
            title={data.incident.title ?? "Incident"}
            description={`Incident ${id}`}
            actions={
              <Link
                href="/admin/platform/status"
                className="rounded-iw-card border border-iw-border px-4 py-2 text-sm font-semibold text-iw-ink"
              >
                Back to status
              </Link>
            }
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card className="p-[var(--aivo-density-card-pad)]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={lifecycleTone(data.incident.lifecycle)}>
                    <span className="capitalize">
                      {String(data.incident.lifecycle ?? "").replace(/_/g, " ")}
                    </span>
                  </Badge>
                  {data.incident.impact ? (
                    <Badge tone={impactTone(data.incident.impact)}>
                      <span className="capitalize">{data.incident.impact} impact</span>
                    </Badge>
                  ) : null}
                </div>
                {data.incident.postmortemUrl ? (
                  <p className="mt-4 text-sm">
                    <a
                      href={data.incident.postmortemUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-iw-primary underline"
                    >
                      Post-mortem
                    </a>
                  </p>
                ) : null}
              </Card>

              <Card className="p-[var(--aivo-density-card-pad)]">
                <p className="mb-4 font-iw-display text-lg font-semibold text-iw-ink">Timeline</p>
                <IncidentTimeline updates={data.updates ?? []} />
              </Card>
            </div>

            <div>
              <Card className="p-[var(--aivo-density-card-pad)]">
                <p className="mb-4 font-iw-display text-base font-semibold text-iw-ink">
                  Manage incident
                </p>
                <IncidentLifecycleControls
                  incidentId={id}
                  current={data.incident.lifecycle ?? ""}
                />
              </Card>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

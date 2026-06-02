import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import {
  getDsar,
  slaFor,
  formatRemaining,
  tenantName,
  type DsarStatus,
} from "@/lib/compliance/governance-store";
import { DsarTimeline } from "@/components/admin/compliance/dsar-timeline";
import { DsarActions } from "@/components/admin/compliance/dsar-actions";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

function statusTone(s: DsarStatus): "success" | "warning" | "neutral" | "danger" {
  if (s === "fulfilled") return "success";
  if (s === "rejected") return "danger";
  if (s === "approved" || s === "fulfilling") return "warning";
  return "neutral";
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole(["platform_admin"]);
  const { id } = await params;
  const dsar = getDsar(id);
  if (!dsar) notFound();

  const sla = slaFor(dsar);
  const slaText = sla.state === "met" ? "Met" : formatRemaining(sla.fulfillmentRemainingMs);
  const slaClass =
    sla.state === "overdue"
      ? "text-aivo-danger font-semibold"
      : sla.state === "due_soon"
        ? "text-amber-600 font-semibold"
        : sla.state === "met"
          ? "text-aivo-success"
          : "text-aivo-ink-soft";

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: "Platform Admin", email: "" }}
    >
      <div className="mb-4">
        <Link
          href="/admin/platform/compliance/dsar"
          className="inline-flex items-center gap-1 text-sm text-aivo-ink-soft hover:text-iw-primary"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to DSAR queue
        </Link>
      </div>

      <PageHeader
        eyebrow="Platform · Compliance · DSAR"
        title={`${dsar.type.charAt(0).toUpperCase() + dsar.type.slice(1)} request`}
        description={`ID: ${dsar.id}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-[var(--aivo-density-card-pad)]">
            <h2 className="font-display font-semibold mb-3">Request details</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-aivo-muted text-xs uppercase font-semibold">Status</dt>
                <dd className="mt-0.5">
                  <Badge tone={statusTone(dsar.status)}>{dsar.status.replace(/_/g, " ")}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-aivo-muted text-xs uppercase font-semibold">Regulation</dt>
                <dd className="mt-0.5 uppercase font-mono">{dsar.regulation}</dd>
              </div>
              <div>
                <dt className="text-aivo-muted text-xs uppercase font-semibold">Type</dt>
                <dd className="mt-0.5 capitalize">{dsar.type}</dd>
              </div>
              <div>
                <dt className="text-aivo-muted text-xs uppercase font-semibold">Tenant</dt>
                <dd className="mt-0.5">{tenantName(dsar.tenantId)}</dd>
              </div>
              <div>
                <dt className="text-aivo-muted text-xs uppercase font-semibold">Subject ID</dt>
                <dd className="mt-0.5 font-mono text-xs">{dsar.subjectId}</dd>
              </div>
              <div>
                <dt className="text-aivo-muted text-xs uppercase font-semibold">Subject type</dt>
                <dd className="mt-0.5">{dsar.subjectType}</dd>
              </div>
              {dsar.subjectEmail && (
                <div>
                  <dt className="text-aivo-muted text-xs uppercase font-semibold">Subject email</dt>
                  <dd className="mt-0.5">{dsar.subjectEmail}</dd>
                </div>
              )}
              <div>
                <dt className="text-aivo-muted text-xs uppercase font-semibold">
                  On behalf of minor
                </dt>
                <dd className="mt-0.5">{dsar.onBehalfOfMinor ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-aivo-muted text-xs uppercase font-semibold">
                  Identity verified
                </dt>
                <dd className="mt-0.5">
                  <Badge tone={dsar.identityVerified ? "success" : "neutral"}>
                    {dsar.identityVerified ? "Verified" : "Unverified"}
                  </Badge>
                </dd>
              </div>
              {dsar.assigneeId && (
                <div>
                  <dt className="text-aivo-muted text-xs uppercase font-semibold">Assignee</dt>
                  <dd className="mt-0.5 font-mono text-xs">{dsar.assigneeId}</dd>
                </div>
              )}
              <div>
                <dt className="text-aivo-muted text-xs uppercase font-semibold">Submitted</dt>
                <dd className="mt-0.5">{new Date(dsar.createdAt).toLocaleString()}</dd>
              </div>
              {dsar.acknowledgedAt && (
                <div>
                  <dt className="text-aivo-muted text-xs uppercase font-semibold">Acknowledged</dt>
                  <dd className="mt-0.5">{new Date(dsar.acknowledgedAt).toLocaleString()}</dd>
                </div>
              )}
              {dsar.fulfilledAt && (
                <div>
                  <dt className="text-aivo-muted text-xs uppercase font-semibold">Fulfilled</dt>
                  <dd className="mt-0.5">{new Date(dsar.fulfilledAt).toLocaleString()}</dd>
                </div>
              )}
            </dl>
          </Card>

          {dsar.evidence.length > 0 && (
            <Card className="p-[var(--aivo-density-card-pad)]">
              <h2 className="font-display font-semibold mb-3">Evidence artifacts</h2>
              <ul className="space-y-2 text-sm">
                {dsar.evidence.map((ev, i) => (
                  <li key={i} className="rounded border border-aivo-border p-3 font-mono text-xs">
                    <pre className="whitespace-pre-wrap break-all">
                      {JSON.stringify(ev, null, 2)}
                    </pre>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-[var(--aivo-density-card-pad)]">
            <h2 className="font-display font-semibold mb-3">Timeline</h2>
            <DsarTimeline events={dsar.events} />
          </Card>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <Card className="p-[var(--aivo-density-card-pad)]">
            <h2 className="font-display font-semibold mb-3">SLA</h2>
            <p className={`text-sm ${slaClass}`}>{slaText}</p>
            {sla.ackOverdue && (
              <p className="text-xs text-aivo-danger mt-1">Acknowledgment overdue</p>
            )}
            <p className="text-xs text-aivo-ink-soft mt-2">
              Fulfillment window: {dsar.fulfillmentDays} days
            </p>
          </Card>

          <Card className="p-[var(--aivo-density-card-pad)]">
            <h2 className="font-display font-semibold mb-3">Actions</h2>
            <DsarActions dsar={dsar} />
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

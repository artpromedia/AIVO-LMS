import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import {
  getModelCard,
  listEvals,
  listIncidents,
  getUsage,
} from "@/lib/services/responsible-ai-svc";
import { ModelCard } from "@/components/admin/ai/ModelCard";
import { EvalResultsChart } from "@/components/admin/ai/EvalResultsChart";
import { IncidentTimeline } from "@/components/admin/ai/IncidentTimeline";
import { UsageSparkline } from "@/components/admin/ai/UsageSparkline";

export const dynamic = "force-dynamic";

function severityTone(s: string): "danger" | "warning" | "neutral" {
  if (s === "critical" || s === "high") return "danger";
  if (s === "medium") return "warning";
  return "neutral";
}

export default async function Page({ params }: { params: { modelId: string } }) {
  const session = await requirePageRole(["platform_admin"]);

  const { model, card, versions } = await getModelCard(params.modelId);
  const evals = await listEvals(params.modelId);
  const incidents = (await listIncidents()).filter((i) => i.modelId === params.modelId);
  const usage = await getUsage(params.modelId);

  const shell = (children: React.ReactNode) => (
    <AppShell
      role={session.role}
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      {children}
    </AppShell>
  );

  if (!model) {
    return shell(
      <>
        <PageHeader eyebrow="Platform · Responsible AI" title="Model" />
        <EmptyState
          title="Model not found"
          description="No model exists with that id."
          action={
            <Link href="/admin/platform/ai" className="text-sm font-semibold text-aivo-primary">
              Back to registry
            </Link>
          }
        />
      </>,
    );
  }

  return shell(
    <>
      <PageHeader
        eyebrow="Platform · Responsible AI"
        title={model.name}
        description={`${model.provider} · ${model.modality}`}
        actions={
          <Link
            href={`/admin/platform/ai/${model.id}/evals/new`}
            className="inline-flex h-11 items-center rounded-full bg-iw-primary px-5 text-sm font-semibold text-iw-primary-fg"
          >
            New eval
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ModelCard model={model} card={card} />

          <Card className="p-[var(--aivo-density-card-pad)]">
            <p className="font-display text-lg font-semibold">Eval history</p>
            {evals.length === 0 ? (
              <p className="mt-3 text-sm text-aivo-ink-soft">No eval runs yet.</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-aivo-ink-soft">
                  <tr>
                    <th className="py-2 text-left">Harness</th>
                    <th className="py-2 text-left">Status</th>
                    <th className="py-2 text-left">Started</th>
                    <th className="py-2 text-left">Triggered by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aivo-border">
                  {evals.map((run) => (
                    <tr key={run.id}>
                      <td className="py-2 font-medium">
                        <Link
                          href={`/admin/platform/ai/${model.id}/evals/new`}
                          className="hover:underline"
                          title="Eval run drill-down"
                        >
                          {run.harness}
                        </Link>
                      </td>
                      <td className="py-2">
                        <Badge tone={run.status === "completed" ? "success" : "neutral"}>
                          {run.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs text-aivo-ink-soft">
                        {new Date(run.startedAt).toLocaleString()}
                      </td>
                      <td className="py-2 text-xs text-aivo-ink-soft">{run.triggeredBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {evals[0] ? (
            <Card className="p-[var(--aivo-density-card-pad)]">
              <p className="font-display text-lg font-semibold">Latest eval metrics</p>
              <div className="mt-4">
                <EvalResultsChart metrics={evals[0].metrics} />
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card className="p-[var(--aivo-density-card-pad)]">
            <p className="font-display text-lg font-semibold">Versions</p>
            {!versions || versions.length === 0 ? (
              <p className="mt-3 text-sm text-aivo-ink-soft">No version history.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {versions.map((v: any, i: number) => (
                  <li key={v?.id ?? i} className="flex items-center justify-between">
                    <span>{v?.label ?? v?.id ?? `Version ${i + 1}`}</span>
                    {v?.id === model.currentVersionId ? (
                      <Badge tone="primary">current</Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-[var(--aivo-density-card-pad)]">
            <p className="font-display text-lg font-semibold">Usage (7d)</p>
            <div className="mt-4">
              <UsageSparkline series={usage.series} />
            </div>
          </Card>

          <Card className="p-[var(--aivo-density-card-pad)]">
            <p className="font-display text-lg font-semibold">Incidents</p>
            {incidents.length === 0 ? (
              <p className="mt-3 text-sm text-aivo-ink-soft">No incidents for this model.</p>
            ) : (
              <div className="mt-4 space-y-5">
                {incidents.map((inc) => (
                  <div key={inc.id}>
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/admin/platform/ai/incidents/${inc.id}`}
                        className="text-sm font-semibold hover:underline"
                      >
                        {inc.title}
                      </Link>
                      <Badge tone={severityTone(inc.severity)}>{inc.severity}</Badge>
                    </div>
                    <div className="mt-3">
                      <IncidentTimeline timeline={inc.timeline} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>,
  );
}

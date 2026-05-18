import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { scopeTenantsForSession, listAiGenerationJobs, computeSystemHealth } from "@/lib/db/repos";
import type { AiGenerationJob } from "@/lib/db/types";
import { Activity, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

const STATUS_TONE: Record<AiGenerationJob["status"], "success" | "danger" | "warning" | "neutral"> =
  {
    complete: "success",
    failed: "danger",
    running: "warning",
    queued: "neutral",
  };

const KIND_LABEL: Record<AiGenerationJob["kind"], string> = {
  brain_profile: "Brain profile",
  lesson_plan: "Lesson plan",
  baseline: "Baseline",
  summary: "Summary",
};

function durationMs(j: AiGenerationJob): number | null {
  if (!j.completedAt) return null;
  return new Date(j.completedAt).getTime() - new Date(j.startedAt).getTime();
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const tenantIds = tenants.map((t) => t.id);
  const jobs = listAiGenerationJobs(tenantIds, 200);
  const h = computeSystemHealth(tenantIds);
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  const byStatus = jobs.reduce<Record<AiGenerationJob["status"], number>>(
    (acc, j) => {
      acc[j.status] = (acc[j.status] ?? 0) + 1;
      return acc;
    },
    { complete: 0, failed: 0, running: 0, queued: 0 },
  );

  const byKind = jobs.reduce<Record<string, number>>((acc, j) => {
    acc[j.kind] = (acc[j.kind] ?? 0) + 1;
    return acc;
  }, {});

  // Median run duration across completed jobs.
  const completedDurations = jobs
    .filter((j) => j.status === "complete" && j.completedAt)
    .map((j) => durationMs(j) ?? 0)
    .sort((a, b) => a - b);
  const median =
    completedDurations.length === 0
      ? null
      : completedDurations[Math.floor(completedDurations.length / 2)];

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Jobs"
        title="Background jobs"
        description="AI generation pipeline — completions, failures, and queue depth across every tenant."
        actions={
          <Badge
            tone={
              h.generationSuccessRate >= 0.9
                ? "success"
                : h.generationSuccessRate >= 0.7
                  ? "warning"
                  : "danger"
            }
          >
            {(h.generationSuccessRate * 100).toFixed(0)}% success
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            k: "Completed",
            v: byStatus.complete,
            Icon: CheckCircle2,
            tone: "success" as const,
          },
          {
            k: "Failed",
            v: byStatus.failed,
            Icon: AlertTriangle,
            tone: "danger" as const,
          },
          {
            k: "Running",
            v: byStatus.running,
            Icon: Activity,
            tone: "warning" as const,
          },
          {
            k: "Queued",
            v: byStatus.queued,
            Icon: Clock,
            tone: "neutral" as const,
          },
        ].map(({ k, v, Icon, tone }) => (
          <Card key={k} className="p-[var(--aivo-density-card-pad)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">{k}</p>
                <p className="mt-1 font-display text-3xl font-bold">{v.toLocaleString()}</p>
              </div>
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-aivo-primary-soft text-aivo-primary"
              >
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <Badge tone={tone} className="mt-3">
              {k.toLowerCase()}
            </Badge>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">By kind</p>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.entries(KIND_LABEL).map(([k, label]) => (
              <li key={k} className="flex items-center justify-between">
                <span className="text-aivo-ink-soft">{label}</span>
                <span className="font-semibold tabular-nums">
                  {(byKind[k] ?? 0).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">Latency</p>
          <p className="mt-1 text-xs text-aivo-ink-soft">
            Median completed-job duration across the last {jobs.length} jobs.
          </p>
          <p className="mt-3 font-display text-3xl font-bold">{formatDuration(median)}</p>
          <p className="mt-1 text-xs text-aivo-ink-soft">
            {completedDurations.length.toLocaleString()} completed jobs sampled
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">Lesson runs</p>
          <p className="mt-1 text-xs text-aivo-ink-soft">
            Learner-facing pipeline downstream of AI generation.
          </p>
          <p className="mt-3 font-display text-3xl font-bold">
            {h.lessonRunsCompleted.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-aivo-ink-soft">
            of {h.lessonRunsTotal.toLocaleString()} attempted
          </p>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-aivo-border px-4 py-3 text-sm font-medium">
          Recent jobs · newest first
        </div>
        {jobs.length === 0 ? (
          <EmptyState title="No AI generation activity yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-aivo-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                <tr>
                  <th className="px-4 py-2">Kind</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Tenant</th>
                  <th className="px-4 py-2">Started</th>
                  <th className="px-4 py-2 text-right">Duration</th>
                  <th className="px-4 py-2">Input</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aivo-border">
                {jobs.map((j) => {
                  const tenant = tenantById.get(j.tenantId);
                  return (
                    <tr key={j.id}>
                      <td className="px-4 py-3 font-medium">{KIND_LABEL[j.kind]}</td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[j.status]}>{j.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-aivo-ink-soft">{tenant?.name ?? j.tenantId}</td>
                      <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                        {new Date(j.startedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-aivo-ink-soft">
                        {formatDuration(durationMs(j))}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-aivo-muted">{j.inputRef}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  );
}

import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import {
  scopeTenantsForSession,
  listLearnersForTenants,
} from "@/lib/db/repos";

const FL_LABEL: Record<string, string> = {
  standard: "Standard",
  supported: "Supported",
  alternative: "Alternative",
  non_verbal: "Non-verbal",
  pre_symbolic: "Pre-symbolic",
};

const FL_TONE: Record<string, "primary" | "success" | "neutral" | "warning"> = {
  standard: "primary",
  supported: "success",
  alternative: "warning",
  non_verbal: "warning",
  pre_symbolic: "neutral",
};

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const learners = listLearnersForTenants(tenants.map((t) => t.id));
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  const flCounts = learners.reduce<Record<string, number>>((acc, l) => {
    const k = l.functioningLevel ?? "unset";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const iepOnFile = learners.filter((l) => l.iepDecision === "uploaded").length;
  const iepSkipped = learners.filter((l) => l.iepDecision === "skipped").length;
  const iepPending = learners.filter((l) => l.iepDecision === null).length;

  // Cross-tenant grade-band rollup.
  const byGrade = learners.reduce<Record<string, number>>((acc, l) => {
    const k = l.gradeBand ?? "Unassigned";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  // Newest 100 — full lists at platform scale would be paginated; we cap
  // visible rows so the page never devolves into a 10k-row dump on cold-boot.
  const recent = [...learners]
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
        eyebrow="Platform"
        title="Learners"
        description="Every learner profile across every tenant on the platform."
        actions={
          <Badge tone="neutral">{learners.length.toLocaleString()} learners</Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            IEPs on file
          </p>
          <p className="mt-1 font-display text-3xl font-bold">
            {iepOnFile.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-aivo-ink-soft">
            {learners.length > 0
              ? `${Math.round((iepOnFile / learners.length) * 100)}% of learners`
              : "No learners"}
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            IEP skipped
          </p>
          <p className="mt-1 font-display text-3xl font-bold">
            {iepSkipped.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-aivo-ink-soft">
            Parent opt-out recorded
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            IEP pending
          </p>
          <p className="mt-1 font-display text-3xl font-bold">
            {iepPending.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-aivo-ink-soft">No decision yet</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">
            Functioning level mix
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.entries(FL_LABEL).map(([k, label]) => {
              const n = flCounts[k] ?? 0;
              const pct =
                learners.length > 0 ? (n / learners.length) * 100 : 0;
              return (
                <li key={k}>
                  <div className="flex items-center justify-between">
                    <span>{label}</span>
                    <span className="text-aivo-ink-soft">
                      {n.toLocaleString()} · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-aivo-border/60">
                    <div
                      className="h-full rounded-full bg-aivo-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
            {flCounts.unset ? (
              <li className="text-xs text-aivo-ink-soft">
                {flCounts.unset.toLocaleString()} learners have no level
                assigned yet.
              </li>
            ) : null}
          </ul>
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">Grade band</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {Object.entries(byGrade)
              .sort((a, b) => b[1] - a[1])
              .map(([grade, n]) => (
                <li
                  key={grade}
                  className="flex items-center justify-between rounded-md border border-aivo-border px-3 py-2"
                >
                  <span className="font-medium">{grade}</span>
                  <span className="text-aivo-ink-soft tabular-nums">
                    {n.toLocaleString()}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-aivo-border px-4 py-3">
          <p className="text-sm font-medium">
            Most recent {recent.length} of {learners.length.toLocaleString()}
          </p>
        </div>
        {recent.length === 0 ? (
          <EmptyState title="No learners yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-aivo-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                <tr>
                  <th className="px-4 py-2">Learner</th>
                  <th className="px-4 py-2">Tenant</th>
                  <th className="px-4 py-2">Grade</th>
                  <th className="px-4 py-2">Functioning level</th>
                  <th className="px-4 py-2">IEP</th>
                  <th className="px-4 py-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aivo-border">
                {recent.map((l) => {
                  const tenant = tenantById.get(l.tenantId);
                  const fl = l.functioningLevel;
                  const iep = l.iepDecision;
                  return (
                    <tr key={l.id}>
                      <td className="px-4 py-3 font-medium">
                        {l.displayName}
                      </td>
                      <td className="px-4 py-3 text-aivo-ink-soft">
                        {tenant?.name ?? l.tenantId}
                      </td>
                      <td className="px-4 py-3 text-aivo-ink-soft">
                        {l.gradeBand ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {fl ? (
                          <Badge tone={FL_TONE[fl] ?? "neutral"}>
                            {FL_LABEL[fl]}
                          </Badge>
                        ) : (
                          <span className="text-xs text-aivo-ink-soft">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            iep === "uploaded"
                              ? "success"
                              : iep === "skipped"
                                ? "neutral"
                                : "warning"
                          }
                        >
                          {iep === "uploaded"
                            ? "On file"
                            : iep === "skipped"
                              ? "Skipped"
                              : "Pending"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                        {new Date(l.createdAt).toLocaleDateString()}
                      </td>
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

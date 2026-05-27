import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import { scopeTenantsForSession, listDistrictLearners, getDistrictStats } from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const tenantIds = tenants.map((t) => t.id);
  const stats = getDistrictStats(tenantIds);
  const rows = await listDistrictLearners(tenantIds);

  const pct = stats.learners > 0 ? Math.round((stats.ieps / stats.learners) * 100) : 0;

  const decisionTone = (d: "uploaded" | "skipped" | null): "success" | "neutral" | "warning" =>
    d === "uploaded" ? "success" : d === "skipped" ? "neutral" : "warning";

  const decisionLabel = (d: "uploaded" | "skipped" | null) =>
    d === "uploaded" ? "On file" : d === "skipped" ? "Skipped" : "Pending";

  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District admin"
        title="IEP compliance"
        description="Track which district learners have IEPs uploaded, skipped, or still pending."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { k: "On file", v: stats.ieps, helper: `${pct}% of learners` },
          {
            k: "Skipped",
            v: rows.filter((r) => r.learner.iepDecision === "skipped").length,
            helper: "Parent explicitly opted out",
          },
          {
            k: "Pending",
            v: rows.filter((r) => r.learner.iepDecision === null).length,
            helper: "No decision recorded yet",
          },
        ].map((s) => (
          <Card key={s.k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">{s.k}</p>
            <p className="mt-1 font-display text-3xl font-bold">{s.v.toLocaleString()}</p>
            <p className="mt-1 text-xs text-aivo-ink-soft">{s.helper}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-aivo-border px-4 py-3">
          <p className="text-sm font-medium">
            {rows.length} {rows.length === 1 ? "learner" : "learners"}
          </p>
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No learners in this district yet" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-aivo-muted">
              <tr>
                <th className="px-4 py-2">Learner</th>
                <th className="px-4 py-2">School</th>
                <th className="px-4 py-2">Family</th>
                <th className="px-4 py-2">Grade</th>
                <th className="px-4 py-2">IEP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aivo-border">
              {rows.map((r) => (
                <tr key={r.learner.id}>
                  <td className="px-4 py-3 font-medium">{r.learner.displayName}</td>
                  <td className="px-4 py-3 text-aivo-ink-soft">{r.schoolName ?? "—"}</td>
                  <td className="px-4 py-3 text-aivo-ink-soft">{r.familyName}</td>
                  <td className="px-4 py-3 text-aivo-ink-soft">{r.learner.gradeBand ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={decisionTone(r.learner.iepDecision)}>
                      {decisionLabel(r.learner.iepDecision)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>
  );
}

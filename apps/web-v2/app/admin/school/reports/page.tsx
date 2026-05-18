import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import { computeSystemHealth, scopeTenantsForSession } from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["school_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const health = computeSystemHealth(tenants.map((t) => t.id));
  const stats = [
    { k: "Lessons completed", v: health.lessonRunsCompleted.toLocaleString() },
    { k: "Total lesson runs", v: health.lessonRunsTotal.toLocaleString() },
    { k: "AI generation success", v: `${Math.round(health.generationSuccessRate * 100)}%` },
    { k: "AI failures", v: health.generationFailureCount.toString() },
  ];

  return (
    <AppShell
      role="school_admin"
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="School admin"
        title="Reports"
        description="Aggregate activity across every family rostered under this school."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">{s.k}</p>
            <p className="mt-1 font-display text-3xl font-bold">{s.v}</p>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}

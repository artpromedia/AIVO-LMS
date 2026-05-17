import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import {
  computeSystemHealth,
  scopeTenantsForSession,
} from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const health = computeSystemHealth(tenants.map((t) => t.id));
  const stats = [
    { k: "Schools", v: tenants.filter((t) => t.type === "school").length },
    { k: "Families", v: tenants.filter((t) => t.type === "family").length },
    { k: "Users", v: health.usersTotal },
    { k: "Lessons completed", v: health.lessonRunsCompleted },
  ];

  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District admin"
        title="District reports"
        description="Roll-up of activity across every school in this district."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
              {s.k}
            </p>
            <p className="mt-1 font-display text-3xl font-bold">
              {s.v.toLocaleString()}
            </p>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}

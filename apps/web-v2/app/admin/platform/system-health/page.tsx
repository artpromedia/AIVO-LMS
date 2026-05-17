import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import {
  computeSystemHealth,
  scopeTenantsForSession,
} from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const h = computeSystemHealth(tenants.map((t) => t.id));
  const ok = h.generationSuccessRate >= 0.9 && h.lessonRunsTotal > 0;
  const byType = tenants.reduce<Record<string, number>>((acc, t) => {
    acc[t.type] = (acc[t.type] ?? 0) + 1;
    return acc;
  }, {});

  const groups: { title: string; stats: { k: string; v: string | number }[] }[] = [
    {
      title: "Tenants",
      stats: [
        { k: "Districts", v: byType.district ?? 0 },
        { k: "Schools", v: byType.school ?? 0 },
        { k: "Families", v: byType.family ?? 0 },
        { k: "Platform", v: byType.platform ?? 0 },
      ],
    },
    {
      title: "Activity",
      stats: [
        { k: "Users", v: h.usersTotal },
        { k: "Lessons completed", v: h.lessonRunsCompleted },
        { k: "Lessons total", v: h.lessonRunsTotal },
      ],
    },
    {
      title: "AI governance",
      stats: [
        { k: "Success", v: `${Math.round(h.generationSuccessRate * 100)}%` },
        { k: "Failures", v: h.generationFailureCount },
        { k: "Queued", v: h.generationQueuedCount },
      ],
    },
  ];

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Observability"
        title="System health"
        description="Live snapshot of the platform's posture."
        actions={
          <Badge tone={ok ? "success" : "warning"}>
            {ok ? "All systems green" : "Degraded"}
          </Badge>
        }
      />
      {groups.map((g) => (
        <section key={g.title} className="mb-6">
          <SectionHeader title={g.title} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {g.stats.map((s) => (
              <Card key={s.k} className="p-[var(--aivo-density-card-pad)]">
                <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                  {s.k}
                </p>
                <p className="mt-1 font-display text-3xl font-bold">
                  {typeof s.v === "number" ? s.v.toLocaleString() : s.v}
                </p>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </AppShell>
  );
}

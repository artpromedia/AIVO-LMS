import { Permission } from "@aivo/security";
import { requirePlatformPage } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { platformNavForSession } from "@/components/layout/role-shells";
import { getPlatformSystemHealth } from "@aivo/admin-api/platform";
import { ROLE_LABEL } from "@/lib/auth/types";

export default async function Page() {
  const session = await requirePlatformPage(Permission.PlatformRead);
  const t = await getTranslations("admin.platform_system_health");
  const health = await getPlatformSystemHealth(session);

  const groups: { title: string; stats: { k: string; v: string | number }[] }[] = [
    {
      title: "Tenants",
      stats: [
        { k: "Districts", v: health.tenantCounts.district },
        { k: "Schools", v: health.tenantCounts.school },
        { k: "Families", v: health.tenantCounts.family },
        { k: "Unknown", v: health.tenantCounts.unknown },
      ],
    },
    {
      title: "Activity",
      stats: [
        { k: "Users", v: health.usersTotal },
        { k: "Learners", v: health.learnersTotal },
        { k: "Lessons completed", v: health.lessonRunsCompleted },
        { k: "Lessons total", v: health.lessonRunsTotal },
      ],
    },
    {
      title: "AI operations (24h)",
      stats: [
        { k: "Requests", v: health.aiRequests24h },
        { k: "Models active", v: health.aiModelsActive24h },
        { k: "Avg latency", v: `${health.aiAvgLatencyMs24h} ms` },
        { k: "Estimated cost", v: `$${health.aiEstimatedCostUsd24h.toFixed(2)}` },
      ],
    },
  ];

  return (
    <AppShell
      role={session.role}
      roleLabel={ROLE_LABEL[session.role]}
      navItems={platformNavForSession(session)}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Observability"
        title={t("title")}
        description="Live snapshot of the platform's posture from admin-svc."
        actions={<Badge tone="neutral">Live service data</Badge>}
      />
      {groups.map((group) => (
        <section key={group.title} className="mb-6">
          <SectionHeader title={group.title} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {group.stats.map((stat) => (
              <Card key={stat.k} className="p-[var(--aivo-density-card-pad)]">
                <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                  {stat.k}
                </p>
                <p className="mt-1 font-display text-3xl font-bold">
                  {typeof stat.v === "number" ? stat.v.toLocaleString() : stat.v}
                </p>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </AppShell>
  );
}

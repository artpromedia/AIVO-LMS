import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { FloatingMetricCard, GlassCard, InsightChip } from "@aivo/ui";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import {
  scopeTenantsForSession,
  getDistrictStats,
  getTenantById,
  getTenantSettings,
  computeSystemHealth,
} from "@/lib/db/repos";
import { Building2, Users, GraduationCap, ClipboardList } from "lucide-react";

const FL_LABELS: Record<string, string> = {
  standard: "Standard",
  supported: "Supported",
  alternative: "Alternative",
  non_verbal: "Non-verbal",
  pre_symbolic: "Pre-symbolic",
  unset: "Unassigned",
};

export default async function DistrictAdminHome() {
  const session = await requirePageRole(["district_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const tenantIds = tenants.map((t) => t.id);
  const stats = getDistrictStats(tenantIds);
  const settings = getTenantSettings(session.tenantId);
  const tenant = getTenantById(session.tenantId);
  const health = computeSystemHealth(tenantIds);
  const t = await getTranslations("admin.district_overview");
  const districtName = settings.branding.displayName ?? tenant?.name ?? "District";

  const kpis: Array<{
    k: string;
    v: number;
    helper: string;
    Icon: typeof Building2;
  }> = [
    {
      k: "Schools",
      v: stats.schools,
      helper: `${stats.families.toLocaleString()} families enrolled`,
      Icon: Building2,
    },
    {
      k: "Staff",
      v: stats.staff,
      helper: `${stats.teachers} teachers · ${stats.schoolAdmins} school admins`,
      Icon: Users,
    },
    {
      k: "Learners",
      v: stats.learners,
      helper: `${stats.parents} parent accounts on file`,
      Icon: GraduationCap,
    },
    {
      k: "IEPs on file",
      v: stats.ieps,
      helper:
        stats.learners > 0
          ? `${Math.round((stats.ieps / stats.learners) * 100)}% of learners`
          : "No learners yet",
      Icon: ClipboardList,
    },
  ];

  const flTotal = stats.flDistribution.reduce((acc, x) => acc + x.count, 0);
  const flMax = stats.flDistribution.reduce((acc, x) => (x.count > acc ? x.count : acc), 0);

  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <header className="flex flex-col gap-2 mb-6">
        <p className="iw-label text-iw-text-muted">{t("eyebrow")}</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-iw-text-strong">{districtName}</h1>
        <p className="text-sm md:text-base text-iw-text-muted max-w-2xl">{t("description")}</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ k, v, helper }) => (
          <FloatingMetricCard
            key={k}
            label={k}
            value={v.toLocaleString()}
            description={helper}
            tone={k === "IEPs on file" ? "info" : k === "Learners" ? "success" : "neutral"}
          />
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <GlassCard
          elevation="raised"
          density="comfortable"
          title={t("fl_distribution_title")}
          description={`${flTotal.toLocaleString()} learners across five AIVO levels`}
          actions={
            <InsightChip tone="neutral" size="md">
              {flTotal.toLocaleString()}
            </InsightChip>
          }
          className="lg:col-span-2"
        >
          {flTotal === 0 ? (
            <p className="text-sm text-iw-text-muted">{t("no_learners")}</p>
          ) : (
            <ul className="space-y-3 mt-2">
              {stats.flDistribution.map((row) => {
                const pct = flTotal === 0 ? 0 : (row.count / flTotal) * 100;
                const barPct = flMax === 0 ? 0 : (row.count / flMax) * 100;
                return (
                  <li key={row.level}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-iw-text-strong">
                        {FL_LABELS[row.level] ?? row.level}
                      </span>
                      <span className="text-iw-text-muted tabular-nums">
                        {row.count.toLocaleString()} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div
                      className="h-2 w-full overflow-hidden rounded-full bg-[var(--aivo-color-surface-sunken)]"
                      role="presentation"
                    >
                      <div
                        className="h-full rounded-full bg-[var(--aivo-sensory-primary)] transition-[width] duration-300"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>

        <GlassCard
          elevation="raised"
          density="comfortable"
          title={t("platform_health_title")}
          description="Last 30 days"
          actions={
            <InsightChip
              tone={health.generationSuccessRate > 0.95 ? "success" : "warning"}
              size="md"
            >
              {(health.generationSuccessRate * 100).toFixed(0)}% OK
            </InsightChip>
          }
        >
          <dl className="space-y-2.5 text-sm mt-2">
            <div className="flex items-center justify-between">
              <dt className="text-iw-text-muted">{t("lessons_completed")}</dt>
              <dd className="font-semibold text-iw-text-strong tabular-nums">
                {health.lessonRunsCompleted.toLocaleString()}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-iw-text-muted">{t("lessons_attempted")}</dt>
              <dd className="font-semibold text-iw-text-strong tabular-nums">
                {health.lessonRunsTotal.toLocaleString()}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-iw-text-muted">{t("ai_jobs_in_queue")}</dt>
              <dd className="font-semibold text-iw-text-strong tabular-nums">
                {health.generationQueuedCount.toLocaleString()}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-iw-text-muted">{t("ai_failures")}</dt>
              <dd className="font-semibold text-iw-text-strong tabular-nums">
                {health.generationFailureCount.toLocaleString()}
              </dd>
            </div>
          </dl>
        </GlassCard>
      </section>
    </AppShell>
  );
}

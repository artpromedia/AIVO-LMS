import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import {
  scopeTenantsForSession,
  getDistrictStats,
  getTenantById,
  getTenantSettings,
  computeSystemHealth,
} from "@/lib/db/repos";
import { Building2, Users, GraduationCap, ClipboardList, Activity } from "lucide-react";

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
      <PageHeader
        eyebrow="District admin"
        title={districtName}
        description="Cross-school oversight, rostering, and reporting."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ k, v, helper, Icon }) => (
          <Card key={k} className="p-[var(--aivo-density-card-pad)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">{k}</p>
                <p className="mt-1 font-display text-3xl font-bold">{v.toLocaleString()}</p>
                <p className="mt-2 text-xs text-aivo-ink-soft">{helper}</p>
              </div>
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-aivo-primary-soft text-aivo-primary"
              >
                <Icon className="h-4 w-4" />
              </span>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)] lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-display text-lg font-semibold">Functioning level distribution</p>
              <p className="text-xs text-aivo-ink-soft">
                How the district&rsquo;s {flTotal.toLocaleString()} learners are spread across the
                five AIVO levels.
              </p>
            </div>
            <Badge tone="neutral">{flTotal.toLocaleString()} learners</Badge>
          </div>
          {flTotal === 0 ? (
            <p className="text-sm text-aivo-ink-soft">No learners assigned yet.</p>
          ) : (
            <ul className="space-y-3">
              {stats.flDistribution.map((row) => {
                const pct = flTotal === 0 ? 0 : (row.count / flTotal) * 100;
                const barPct = flMax === 0 ? 0 : (row.count / flMax) * 100;
                return (
                  <li key={row.level}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{FL_LABELS[row.level] ?? row.level}</span>
                      <span className="text-aivo-ink-soft">
                        {row.count.toLocaleString()} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div
                      className="h-2 w-full overflow-hidden rounded-full bg-aivo-border/60"
                      role="presentation"
                    >
                      <div
                        className="h-full rounded-full bg-aivo-primary"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)]">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-aivo-primary" />
            <p className="font-display text-lg font-semibold">Platform health</p>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-aivo-ink-soft">Lessons completed</dt>
              <dd className="font-semibold">{health.lessonRunsCompleted.toLocaleString()}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-aivo-ink-soft">Lessons attempted</dt>
              <dd className="font-semibold">{health.lessonRunsTotal.toLocaleString()}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-aivo-ink-soft">AI success rate</dt>
              <dd className="font-semibold">{(health.generationSuccessRate * 100).toFixed(0)}%</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-aivo-ink-soft">AI jobs in queue</dt>
              <dd className="font-semibold">{health.generationQueuedCount.toLocaleString()}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-aivo-ink-soft">AI failures</dt>
              <dd className="font-semibold">{health.generationFailureCount.toLocaleString()}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </AppShell>
  );
}

import { Permission } from "@aivo/security";
import { requirePlatformPage } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { platformNavForSession } from "@/components/layout/role-shells";
import { listAdminLearners, listAdminTenants } from "@/lib/admin-api/platform";
import { ROLE_LABEL } from "@/lib/auth/types";

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

function normalizeFunctioningLevel(value: string | null | undefined): string | null {
  return value ? value.toLowerCase() : null;
}

function functioningLevelLabel(value: string | null | undefined): string {
  const key = normalizeFunctioningLevel(value);
  if (!key) return "Unassigned";
  return FL_LABEL[key] ?? key.replace(/_/g, " ");
}

export default async function Page() {
  const session = await requirePlatformPage(Permission.LearnerRead);
  const t = await getTranslations("admin.platform_learners");
  const [learners, tenants] = await Promise.all([
    listAdminLearners(session),
    listAdminTenants(session).catch(() => []),
  ]);

  const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  const assignedLevels = learners.filter((learner) => learner.functioningLevel).length;
  const unassignedLevels = learners.length - assignedLevels;
  const distinctTenants = new Set(learners.map((learner) => learner.tenantId).filter(Boolean)).size;

  const flCounts = learners.reduce<Record<string, number>>((acc, learner) => {
    const key = normalizeFunctioningLevel(learner.functioningLevel) ?? "unset";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const byGrade = learners.reduce<Record<string, number>>((acc, learner) => {
    const key =
      learner.gradeLevel === null || learner.gradeLevel === undefined
        ? "Unassigned"
        : `Grade ${learner.gradeLevel}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const recent = [...learners].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);

  return (
    <AppShell
      role={session.role}
      roleLabel={ROLE_LABEL[session.role]}
      navItems={platformNavForSession(session)}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform"
        title={t("title")}
        description="Live learner roster from identity-svc across every tenant."
        actions={<Badge tone="neutral">{learners.length.toLocaleString()} learners</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            Learners with level
          </p>
          <p className="mt-1 font-display text-3xl font-bold">{assignedLevels.toLocaleString()}</p>
          <p className="mt-1 text-xs text-aivo-ink-soft">
            {learners.length > 0
              ? `${Math.round((assignedLevels / learners.length) * 100)}% assigned`
              : "No learners"}
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            Level pending
          </p>
          <p className="mt-1 font-display text-3xl font-bold">
            {unassignedLevels.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-aivo-ink-soft">No functioning level on the learner row</p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            Tenant footprint
          </p>
          <p className="mt-1 font-display text-3xl font-bold">{distinctTenants.toLocaleString()}</p>
          <p className="mt-1 text-xs text-aivo-ink-soft">Tenants with at least one learner</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">{t("fl_mix")}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.entries({ ...FL_LABEL, unset: "Unassigned" }).map(([key, label]) => {
              const count = flCounts[key] ?? 0;
              const pct = learners.length > 0 ? (count / learners.length) * 100 : 0;
              return (
                <li key={key}>
                  <div className="flex items-center justify-between">
                    <span>{label}</span>
                    <span className="text-aivo-ink-soft">
                      {count.toLocaleString()} | {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-aivo-border/60">
                    <div className="h-full rounded-full bg-aivo-primary" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">{t("grade_band")}</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {Object.entries(byGrade)
              .sort((a, b) => b[1] - a[1])
              .map(([grade, count]) => (
                <li
                  key={grade}
                  className="flex items-center justify-between rounded-md border border-aivo-border px-3 py-2"
                >
                  <span className="font-medium">{grade}</span>
                  <span className="text-aivo-ink-soft tabular-nums">{count.toLocaleString()}</span>
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
          <EmptyState title={t("empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-aivo-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                <tr>
                  <th className="px-4 py-2">{t("col_learner")}</th>
                  <th className="px-4 py-2">{t("col_tenant")}</th>
                  <th className="px-4 py-2">Grade</th>
                  <th className="px-4 py-2">{t("col_fl")}</th>
                  <th className="px-4 py-2">{t("col_created")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aivo-border">
                {recent.map((learner) => {
                  const normalizedLevel = normalizeFunctioningLevel(learner.functioningLevel);
                  return (
                    <tr key={learner.id}>
                      <td className="px-4 py-3 font-medium">{learner.name}</td>
                      <td className="px-4 py-3 text-aivo-ink-soft">
                        {tenantById.get(learner.tenantId ?? "")?.name ?? learner.tenantId ?? "Unknown"}
                      </td>
                      <td className="px-4 py-3 text-aivo-ink-soft">
                        {learner.gradeLevel === null || learner.gradeLevel === undefined
                          ? "\u2014"
                          : learner.gradeLevel}
                      </td>
                      <td className="px-4 py-3">
                        {normalizedLevel ? (
                          <Badge tone={FL_TONE[normalizedLevel] ?? "neutral"}>
                            {functioningLevelLabel(learner.functioningLevel)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-aivo-ink-soft">{t("unassigned")}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                        {new Date(learner.createdAt).toLocaleDateString()}
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

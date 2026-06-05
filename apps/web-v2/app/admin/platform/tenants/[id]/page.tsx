import Link from "next/link";
import { notFound } from "next/navigation";
import { Permission } from "@aivo/security";
import { requirePlatformPage } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { platformNavForSession } from "@/components/layout/role-shells";
import { getAdminTenant } from "@/lib/admin-api/platform";
import { listBillingAccounts } from "@/lib/admin-api/billing";
import { ROLE_LABEL } from "@/lib/auth/types";
import { ArrowLeft } from "lucide-react";
import { billingTone } from "@/lib/admin-api/types";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePlatformPage(Permission.TenantRead);
  const t = await getTranslations("admin.platform_tenants_detail");

  let tenant;
  try {
    tenant = await getAdminTenant(session, id);
  } catch {
    notFound();
  }
  if (!tenant) notFound();

  const billing = (await listBillingAccounts(session).catch(() => [])).find(
    (account) => account.tenantId === tenant.id,
  );

  const usersByRole = tenant.users.reduce<Record<string, number>>((acc, user) => {
    acc[user.roleLabel] = (acc[user.roleLabel] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AppShell
      role={session.role}
      roleLabel={ROLE_LABEL[session.role]}
      navItems={platformNavForSession(session)}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <Link
        href="/admin/platform/tenants"
        className="mb-3 inline-flex items-center text-sm text-aivo-ink-soft hover:text-aivo-ink"
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" /> {t("all_tenants")}
      </Link>
      <PageHeader
        eyebrow={`Platform · ${tenant.typeLabel}`}
        title={tenant.name}
        description="Real tenant detail sourced from admin-svc and identity-svc."
        actions={
          <span className="inline-flex items-center gap-2">
            <Badge tone={tenant.tenantKind === "district" ? "primary" : tenant.tenantKind === "school" ? "success" : "neutral"}>
              {tenant.typeLabel}
            </Badge>
            {billing ? <Badge tone={billingTone(billing.status)}>{billing.plan}</Badge> : null}
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">Users</p>
          <p className="mt-1 font-display text-3xl font-bold">{tenant.userCount.toLocaleString()}</p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            {t("stat_learners")}
          </p>
          <p className="mt-1 font-display text-3xl font-bold">
            {tenant.learnerCount.toLocaleString()}
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">Status</p>
          <p className="mt-1 text-sm font-medium">{tenant.status ?? "active"}</p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            {t("stat_created")}
          </p>
          <p className="mt-1 text-sm font-medium">
            {new Date(tenant.createdAt).toLocaleDateString()}
          </p>
          <p className="mt-1 font-mono text-xs text-aivo-muted">{tenant.id}</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">User mix</p>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.entries(usersByRole)
              .sort((a, b) => b[1] - a[1])
              .map(([roleLabel, count]) => (
                <li key={roleLabel} className="flex items-center justify-between">
                  <span className="text-aivo-ink-soft">{roleLabel}</span>
                  <span className="font-semibold tabular-nums">{count.toLocaleString()}</span>
                </li>
              ))}
          </ul>
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)] lg:col-span-2">
          <p className="font-display text-lg font-semibold">Billing snapshot</p>
          {billing ? (
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">Plan</dt>
                <dd className="mt-1 text-sm">{billing.plan}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">Status</dt>
                <dd className="mt-1 text-sm">{billing.status.replace("_", " ")}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                  Current period end
                </dt>
                <dd className="mt-1 text-sm">
                  {billing.currentPeriodEnd
                    ? new Date(billing.currentPeriodEnd).toLocaleDateString()
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                  Payment status
                </dt>
                <dd className="mt-1 text-sm">{billing.paymentStatus ?? "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-aivo-ink-soft">No subscription row recorded for this tenant.</p>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-aivo-border px-4 py-3">
            <p className="font-display text-lg font-semibold">Users</p>
          </div>
          {tenant.users.length === 0 ? (
            <EmptyState title={t("no_users")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-aivo-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aivo-border">
                  {tenant.users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-3 font-medium">{user.name}</td>
                      <td className="px-4 py-3 text-aivo-ink-soft">{user.email ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={user.roleTone}>{user.roleLabel}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-aivo-border px-4 py-3">
            <p className="font-display text-lg font-semibold">Learners</p>
          </div>
          {tenant.learners.length === 0 ? (
            <EmptyState title={t("no_nested_tenants")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-aivo-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                  <tr>
                    <th className="px-4 py-2">{t("stat_learners")}</th>
                    <th className="px-4 py-2">Grade</th>
                    <th className="px-4 py-2">{t("stat_created")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aivo-border">
                  {tenant.learners.map((learner) => (
                    <tr key={learner.id}>
                      <td className="px-4 py-3 font-medium">{learner.name}</td>
                      <td className="px-4 py-3 text-aivo-ink-soft">
                        {learner.gradeLevel ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                        {new Date(learner.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

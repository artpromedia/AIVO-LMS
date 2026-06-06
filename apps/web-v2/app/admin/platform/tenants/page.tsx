import Link from "next/link";
import { Permission } from "@aivo/security";
import { requirePlatformPage } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { platformNavForSession } from "@/components/layout/role-shells";
import {
  listAdminLearners,
  listAdminTenants,
  listAdminUsers,
} from "@aivo/admin-api/platform";
import { listBillingAccounts } from "@aivo/admin-api/billing";
import { ROLE_LABEL } from "@/lib/auth/types";
import { billingTone } from "@aivo/admin-api/types";

const TYPE_ORDER: Record<string, number> = {
  district: 0,
  school: 1,
  family: 2,
  unknown: 3,
};

export default async function Page() {
  const session = await requirePlatformPage(Permission.TenantRead);
  const t = await getTranslations("admin.platform_tenants");
  const [tenants, users, learners, accounts] = await Promise.all([
    listAdminTenants(session),
    listAdminUsers(session).catch(() => []),
    listAdminLearners(session).catch(() => []),
    listBillingAccounts(session).catch(() => []),
  ]);

  const billingByTenant = new Map(accounts.map((account) => [account.tenantId, account]));
  const userCountByTenant = new Map<string, number>();
  const adminCountByTenant = new Map<string, number>();
  for (const user of users) {
    if (!user.tenantId) continue;
    userCountByTenant.set(user.tenantId, (userCountByTenant.get(user.tenantId) ?? 0) + 1);
    if (user.roleKey === "platform_admin" || user.roleKey === "district_admin" || user.roleKey === "school_admin") {
      adminCountByTenant.set(user.tenantId, (adminCountByTenant.get(user.tenantId) ?? 0) + 1);
    }
  }

  const learnerCountByTenant = new Map<string, number>();
  for (const learner of learners) {
    if (!learner.tenantId) continue;
    learnerCountByTenant.set(
      learner.tenantId,
      (learnerCountByTenant.get(learner.tenantId) ?? 0) + 1,
    );
  }

  const byType = tenants.reduce<Record<string, number>>((acc, tenant) => {
    acc[tenant.tenantKind] = (acc[tenant.tenantKind] ?? 0) + 1;
    return acc;
  }, {});

  const sorted = [...tenants].sort((a, b) => {
    const kindDelta = (TYPE_ORDER[a.tenantKind] ?? 99) - (TYPE_ORDER[b.tenantKind] ?? 99);
    return kindDelta !== 0 ? kindDelta : a.name.localeCompare(b.name);
  });

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
        description="Every tenant currently visible through admin-svc."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          { k: "Districts", v: byType.district ?? 0 },
          { k: "Schools", v: byType.school ?? 0 },
          { k: "Families", v: byType.family ?? 0 },
          { k: "Unknown", v: byType.unknown ?? 0 },
        ].map((item) => (
          <Card key={item.k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">{item.k}</p>
            <p className="mt-1 font-display text-3xl font-bold">{item.v.toLocaleString()}</p>
          </Card>
        ))}
      </div>

      {tenants.length === 0 ? (
        <EmptyState title={t("empty_title")} />
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-aivo-border px-4 py-3 text-sm font-medium">
            {tenants.length.toLocaleString()} {tenants.length === 1 ? "tenant" : "tenants"}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-aivo-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">{t("col_parent")}</th>
                  <th className="px-4 py-2 text-right">Users</th>
                  <th className="px-4 py-2 text-right">{t("col_admins")}</th>
                  <th className="px-4 py-2 text-right">{t("col_learners")}</th>
                  <th className="px-4 py-2">{t("col_billing")}</th>
                  <th className="px-4 py-2">{t("col_created")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aivo-border">
                {sorted.map((tenant) => {
                  const billing = billingByTenant.get(tenant.id);
                  return (
                    <tr key={tenant.id} className="hover:bg-aivo-surface-2/60">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/platform/tenants/${tenant.id}`}
                          className="font-medium hover:text-aivo-primary"
                        >
                          {tenant.name}
                        </Link>
                        <p className="font-mono text-xs text-aivo-muted">{tenant.id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={tenant.tenantKind === "district" ? "primary" : tenant.tenantKind === "school" ? "success" : "neutral"}>
                          {tenant.typeLabel}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-aivo-ink-soft">—</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {(userCountByTenant.get(tenant.id) ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {(adminCountByTenant.get(tenant.id) ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {(learnerCountByTenant.get(tenant.id) ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {billing ? (
                          <span className="inline-flex items-center gap-2">
                            <Badge tone={billingTone(billing.status)}>
                              {billing.status.replace("_", " ")}
                            </Badge>
                            <span className="text-xs text-aivo-ink-soft">{billing.plan}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-aivo-ink-soft">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                        {new Date(tenant.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="mt-4 text-xs text-aivo-ink-soft">
        Looking for billing accounts?{" "}
        <Link href="/admin/platform/billing" className="font-medium text-aivo-primary hover:underline">
          {t("open_billing")}
        </Link>
        .
      </p>
    </AppShell>
  );
}

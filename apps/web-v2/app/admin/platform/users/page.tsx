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
import { listAdminTenants, listAdminUsers } from "@aivo/admin-api/platform";
import { ROLE_LABEL } from "@/lib/auth/types";

const ROLE_ORDER = [
  "platform_admin",
  "district_admin",
  "school_admin",
  "teacher",
  "support",
  "customer_care",
  "sales",
  "marketing",
  "finance",
  "devops",
  "engineering",
  "sped_lead",
  "parent",
  "caregiver",
  "therapist",
  "learner",
  "unknown",
] as const;

export default async function Page() {
  const session = await requirePlatformPage(Permission.UserRead);
  const t = await getTranslations("admin.platform_users");
  const [users, tenants] = await Promise.all([
    listAdminUsers(session),
    listAdminTenants(session).catch(() => []),
  ]);
  const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));

  const byRole = users.reduce<Record<string, number>>((acc, user) => {
    acc[user.roleKey] = (acc[user.roleKey] ?? 0) + 1;
    return acc;
  }, {});

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
        description="Every real user account currently visible through admin-svc."
        actions={<Badge tone="neutral">{users.length.toLocaleString()} users</Badge>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ROLE_ORDER.filter((role) => (byRole[role] ?? 0) > 0).map((role) => (
          <Card key={role} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
              {role.replaceAll("_", " ")}
            </p>
            <p className="mt-1 font-display text-2xl font-bold">
              {(byRole[role] ?? 0).toLocaleString()}
            </p>
          </Card>
        ))}
      </div>

      {users.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-aivo-border px-4 py-3 text-sm font-medium">
            {users.length.toLocaleString()} users
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-aivo-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">{t("col_tenant")}</th>
                  <th className="px-4 py-2">{t("col_joined")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aivo-border">
                {users.map((user) => {
                  const tenant = user.tenantId ? tenantById.get(user.tenantId) : null;
                  return (
                    <tr key={user.id} className="hover:bg-aivo-surface-2/60">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/platform/users/${user.id}`}
                          className="font-medium hover:text-aivo-primary"
                        >
                          {user.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-aivo-ink-soft">{user.email ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={user.roleTone}>{user.roleLabel}</Badge>
                      </td>
                      <td className="px-4 py-3 text-aivo-ink-soft">
                        {tenant ? (
                          <Link
                            href={`/admin/platform/tenants/${tenant.id}`}
                            className="hover:text-aivo-primary"
                          >
                            {tenant.name} · {tenant.typeLabel}
                          </Link>
                        ) : (
                          user.tenantId ?? "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AppShell>
  );
}

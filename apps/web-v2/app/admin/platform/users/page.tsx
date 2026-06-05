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
import { listUsersForTenants, scopeTenantsForSession } from "@/lib/db/repos";
import { ROLE_LABEL, type Role } from "@/lib/auth/types";

const ROLE_LABEL: Record<Role, string> = {
  parent: "Parent",
  learner: "Learner",
  teacher: "Teacher",
  caregiver: "Caregiver",
  therapist: "Therapist",
  school_admin: "School admin",
  district_admin: "District admin",
  platform_admin: "Platform admin",
  support: "Support",
  marketing: "Marketing",
  sales: "Sales",
  devops: "DevOps",
  engineering: "Engineering",
};

const ROLE_TONE: Record<Role, "primary" | "success" | "neutral" | "warning"> = {
  parent: "neutral",
  learner: "primary",
  teacher: "success",
  caregiver: "neutral",
  therapist: "neutral",
  school_admin: "success",
  district_admin: "primary",
  platform_admin: "warning",
  support: "warning",
  marketing: "warning",
  sales: "warning",
  devops: "warning",
  engineering: "warning",
};

// Display order: privileged → educator → end-user.
const ROLE_ORDER: Role[] = [
  "platform_admin",
  "district_admin",
  "school_admin",
  "teacher",
  "support",
  "marketing",
  "sales",
  "devops",
  "engineering",
  "parent",
  "learner",
];

export default async function Page() {
  const session = await requirePlatformPage(Permission.UserRead);
  const t = await getTranslations("admin.platform_users");
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const users = await listUsersForTenants(tenants.map((t) => t.id));
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  const byRole = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  // Distinct underlying user accounts (a single account can appear in many
  // tenants via different memberships — we want both numbers visible).
  const uniqueUsers = new Set(users.map((u) => u.user.id)).size;

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
        description="Every user across every tenant on the platform."
        actions={
          <Badge tone="neutral">
            {uniqueUsers.toLocaleString()} unique · {users.length.toLocaleString()} memberships
          </Badge>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ROLE_ORDER.map((r) => (
          <Card key={r} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
              {ROLE_LABEL[r]}
            </p>
            <p className="mt-1 font-display text-2xl font-bold">
              {(byRole[r] ?? 0).toLocaleString()}
            </p>
          </Card>
        ))}
      </div>

      {users.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-aivo-border px-4 py-3 text-sm font-medium">
            {users.length.toLocaleString()} memberships
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
                {users.map((u) => {
                  const tenant = tenantById.get(u.tenantId);
                  return (
                    <tr
                      key={`${u.user.id}-${u.tenantId}-${u.role}`}
                      className="hover:bg-aivo-surface-2/60"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/platform/users/${u.user.id}`}
                          className="font-medium hover:text-aivo-primary"
                        >
                          {u.user.displayName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-aivo-ink-soft">{u.user.email}</td>
                      <td className="px-4 py-3">
                        <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-aivo-ink-soft">
                        {tenant ? (
                          <Link
                            href={`/admin/platform/tenants/${u.tenantId}`}
                            className="hover:text-aivo-primary"
                          >
                            {tenant.name} · {tenant.type}
                          </Link>
                        ) : (
                          u.tenantId
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                        {new Date(u.joinedAt).toLocaleDateString()}
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

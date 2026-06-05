import Link from "next/link";
import { notFound } from "next/navigation";
import { Permission } from "@aivo/security";
import { requirePlatformPage } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { platformNavForSession } from "@/components/layout/role-shells";
import { getAdminUser } from "@/lib/admin-api/platform";
import { ROLE_LABEL } from "@/lib/auth/types";
import { ArrowLeft } from "lucide-react";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { UserRolesCard } from "./user-roles-card";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePlatformPage(Permission.UserRead);
  const t = await getTranslations("admin.platform_users_detail");
  const canGrantRoles = sessionHasPermission(session, Permission.RoleGrant);

  let user;
  try {
    user = await getAdminUser(session, id);
  } catch {
    notFound();
  }
  if (!user) notFound();

  return (
    <AppShell
      role={session.role}
      roleLabel={ROLE_LABEL[session.role]}
      navItems={platformNavForSession(session)}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <Link
        href="/admin/platform/users"
        className="mb-3 inline-flex items-center text-sm text-aivo-ink-soft hover:text-aivo-ink"
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" /> {t("all_users")}
      </Link>
      <PageHeader
        eyebrow="Platform · User"
        title={user.name}
        description={user.email ?? "No email on record"}
        actions={<Badge tone={user.roleTone}>{user.roleLabel}</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            {t("user_id")}
          </p>
          <p className="mt-1 font-mono text-sm">{user.id}</p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">Tenant</p>
          <p className="mt-1 text-sm font-medium">
            {user.tenant ? `${user.tenant.name} · ${user.tenant.typeLabel}` : "—"}
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            {t("col_created")}
          </p>
          <p className="mt-1 text-sm font-medium">
            {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            Active sessions
          </p>
          <p className="mt-1 font-display text-2xl font-bold">
            {user.activeSessions?.toLocaleString() ?? "0"}
          </p>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">Authentication</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-aivo-ink-soft">Email verified</dt>
              <dd>{user.emailVerified ? "Yes" : "No"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-aivo-ink-soft">Google login</dt>
              <dd>{user.hasGoogle ? "Connected" : "No"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-aivo-ink-soft">Apple login</dt>
              <dd>{user.hasApple ? "Connected" : "No"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-aivo-ink-soft">Last login</dt>
              <dd>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)] lg:col-span-2">
          <p className="font-display text-lg font-semibold">Profile</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                Email
              </dt>
              <dd className="mt-1 text-sm">{user.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                Role
              </dt>
              <dd className="mt-1 text-sm">{user.roleLabel}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                Updated
              </dt>
              <dd className="mt-1 text-sm">
                {user.updatedAt ? new Date(user.updatedAt).toLocaleString() : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                Deactivated
              </dt>
              <dd className="mt-1 text-sm">
                {user.deactivatedAt ? new Date(user.deactivatedAt).toLocaleString() : "No"}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {canGrantRoles ? (
        <Card className="mt-6 p-[var(--aivo-density-card-pad)]">
          <p className="mb-3 font-display text-lg font-semibold">Additional roles</p>
          <UserRolesCard userId={user.id} />
        </Card>
      ) : null}

      {user.learners.length > 0 ? (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-aivo-border px-4 py-3">
            <p className="font-display text-lg font-semibold">{t("managed_learners")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-aivo-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                <tr>
                  <th className="px-4 py-2">{t("col_learner")}</th>
                  <th className="px-4 py-2">Grade</th>
                  <th className="px-4 py-2">{t("col_created")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aivo-border">
                {user.learners.map((learner) => (
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
        </Card>
      ) : null}
    </AppShell>
  );
}

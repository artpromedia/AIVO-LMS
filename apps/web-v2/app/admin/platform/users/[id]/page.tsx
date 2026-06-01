import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import {
  scopeTenantsForSession,
  getUserById,
  listMembershipsForUser,
  listLearnersForParent,
} from "@/lib/db/repos";
import type { Role } from "@/lib/auth/types";
import { ArrowLeft } from "lucide-react";
import { UserRolesCard } from "./user-roles-card";

const ROLE_LABEL: Record<Role, string> = {
  parent: "Parent",
  learner: "Learner",
  teacher: "Teacher",
  caregiver: "Caregiver",
  therapist: "Therapist",
  school_admin: "School admin",
  district_admin: "District admin",
  platform_admin: "Platform admin",
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
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.platform_users_detail");
  const user = await getUserById(id);
  if (!user) notFound();

  // Only show memberships inside the caller's visible tenant scope.
  const visibleTenants = scopeTenantsForSession(session.role, session.tenantId);
  const visibleIds = new Set(visibleTenants.map((t) => t.id));
  const allMemberships = await listMembershipsForUser(user.id);
  const memberships = allMemberships.filter((m) => visibleIds.has(m.tenantId));
  if (memberships.length === 0) notFound();

  const tenantById = new Map(visibleTenants.map((t) => [t.id, t]));

  // If parent, list the learners they manage (across all their tenants).
  const parentMemberships = memberships.filter((m) => m.role === "parent");
  const managedNested = await Promise.all(
    parentMemberships.map((m) => listLearnersForParent(user.id, m.tenantId)),
  );
  const managedLearners = managedNested.flat();

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
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
        title={user.displayName}
        description={user.email}
        actions={
          <Badge tone="neutral">
            {memberships.length} {memberships.length === 1 ? "membership" : "memberships"}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">{t("user_id")}</p>
          <p className="mt-1 font-mono text-sm">{user.id}</p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">{t("col_created")}</p>
          <p className="mt-1 text-sm font-medium">
            {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            {t("managed_learners")}
          </p>
          <p className="mt-1 font-display text-2xl font-bold">
            {managedLearners.length.toLocaleString()}
          </p>
        </Card>
      </div>

      <Card className="mt-6 p-[var(--aivo-density-card-pad)]">
        <p className="mb-3 font-display text-lg font-semibold">Additional roles</p>
        <UserRolesCard userId={user.id} />
      </Card>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-aivo-border px-4 py-3">
          <p className="font-display text-lg font-semibold">{t("memberships")}</p>
        </div>
        {memberships.length === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-aivo-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                <tr>
                  <th className="px-4 py-2">{t("col_tenant")}</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">{t("col_permissions")}</th>
                  <th className="px-4 py-2">{t("col_joined")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aivo-border">
                {memberships.map((m) => {
                  const t = tenantById.get(m.tenantId);
                  return (
                    <tr key={`${m.userId}-${m.tenantId}-${m.role}`}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/platform/tenants/${m.tenantId}`}
                          className="font-medium hover:text-aivo-primary"
                        >
                          {t?.name ?? m.tenantId}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-aivo-ink-soft">{t?.type ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={ROLE_TONE[m.role]}>{ROLE_LABEL[m.role]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                        {m.permissions.length === 0 ? "—" : m.permissions.join(", ")}
                      </td>
                      <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {managedLearners.length > 0 ? (
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
                  <th className="px-4 py-2">{t("col_tenant")}</th>
                  <th className="px-4 py-2">{t("col_created")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aivo-border">
                {managedLearners.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 font-medium">{l.displayName}</td>
                    <td className="px-4 py-3 text-aivo-ink-soft">{l.gradeBand ?? "—"}</td>
                    <td className="px-4 py-3 text-aivo-ink-soft">
                      {tenantById.get(l.tenantId)?.name ?? l.tenantId}
                    </td>
                    <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                      {new Date(l.createdAt).toLocaleDateString()}
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

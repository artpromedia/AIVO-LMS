import { cookies } from "next/headers";
import { Permission } from "@aivo/security";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import {
  scopeTenantsForSession,
  listMembersByRole,
  getTenantById,
  getDistrictStats,
} from "@/lib/db/repos";
import { listStaffInvitesForTenants } from "@/lib/db/staff-invites";
import {
  IDENTITY_ACCESS_TOKEN_COOKIE,
  identityListDistrictSchools,
  identityListDistrictAdmins,
  mapWireRoleToRole,
} from "@/lib/auth/identity-client";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { StaffInviteSection } from "./staff-invite-section";

type PendingInviteRow = {
  id: string;
  email: string;
  role: "district_admin" | "school_admin" | "teacher";
  displayName: string;
  invitedAt: string;
  schoolId: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  district_admin: "District admin",
  school_admin: "School admin",
  teacher: "Teacher",
};

const ROLE_TONE: Record<string, "primary" | "neutral" | "success"> = {
  district_admin: "primary",
  school_admin: "success",
  teacher: "neutral",
};

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  const t = await getTranslations("admin.district_staff");
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const tenantIds = tenants.map((t) => t.id);
  const canManageStaff =
    sessionHasPermission(session, Permission.TeacherCreate) ||
    sessionHasPermission(session, Permission.UserManage);
  const stats = getDistrictStats(tenantIds);
  const staff = await listMembersByRole(tenantIds, ["district_admin", "school_admin", "teacher"]);

  // Real-auth: source the school dropdown + pending invites from identity-svc
  // so invites persist and email for real. Demo fallback uses the in-memory
  // store. (The stats + active-staff table above remain demo read models for
  // now — see docs/PLATFORM_GAP_ANALYSIS.md §9.)
  const accessToken = (await cookies()).get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
  let schools: Array<{ id: string; name: string }>;
  let pendingInvites: PendingInviteRow[];
  if (accessToken) {
    const [schoolsRes, adminsRes] = await Promise.all([
      identityListDistrictSchools(accessToken),
      identityListDistrictAdmins(accessToken),
    ]);
    schools = schoolsRes.ok ? schoolsRes.schools : [];
    pendingInvites = adminsRes.ok
      ? adminsRes.pendingInvites.map((i) => ({
          id: i.id,
          email: i.email,
          role: (mapWireRoleToRole(i.role) ?? "teacher") as PendingInviteRow["role"],
          displayName: i.name,
          invitedAt: i.createdAt,
          schoolId: i.schoolId,
        }))
      : [];
  } else {
    pendingInvites = listStaffInvitesForTenants(tenantIds).map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      displayName: i.displayName,
      invitedAt: i.invitedAt,
      schoolId: i.schoolId,
    }));
    schools = tenants
      .filter((tn) => tn.type === "school")
      .map((tn) => ({ id: tn.id, name: tn.name }));
  }

  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District admin"
        title={t("title")}
        description="Every administrator and teacher across this district's schools."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { k: "District admins", v: stats.districtAdmins },
          { k: "School admins", v: stats.schoolAdmins },
          { k: "Teachers", v: stats.teachers },
        ].map((s) => (
          <Card key={s.k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">{s.k}</p>
            <p className="mt-1 font-display text-3xl font-bold">{s.v.toLocaleString()}</p>
          </Card>
        ))}
      </div>

      <SectionHeader title={t("invitations_heading")} />
      {canManageStaff ? (
        <StaffInviteSection schools={schools} pendingInvites={pendingInvites} />
      ) : (
        <Card className="p-[var(--aivo-density-card-pad)] text-sm text-aivo-ink-soft">
          Your current role can review staff posture here but cannot create or revoke subordinate
          accounts.
        </Card>
      )}

      <SectionHeader title={t("active_staff_heading")} />
      <Card className="overflow-hidden">
        <div className="border-b border-aivo-border px-4 py-3">
          <p className="text-sm font-medium">
            {staff.length} {staff.length === 1 ? "person" : "people"}
          </p>
        </div>
        {staff.length === 0 ? (
          <EmptyState title={t("empty_title")} />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-aivo-muted">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Site</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">{t("col_joined")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aivo-border">
              {staff.map((m) => {
                const tenant = getTenantById(m.tenantId);
                return (
                  <tr key={`${m.user.id}-${m.tenantId}`}>
                    <td className="px-4 py-3 font-medium">{m.user.displayName}</td>
                    <td className="px-4 py-3">
                      <Badge tone={ROLE_TONE[m.role] ?? "neutral"}>
                        {ROLE_LABEL[m.role] ?? m.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-aivo-ink-soft">{tenant?.name ?? m.tenantId}</td>
                    <td className="px-4 py-3 text-aivo-ink-soft">{m.user.email}</td>
                    <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                      {new Date(m.joinedAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>
  );
}

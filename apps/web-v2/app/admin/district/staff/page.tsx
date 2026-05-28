import { requirePageRole } from "@/lib/auth/server";
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
import { StaffInviteSection } from "./staff-invite-section";

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
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const tenantIds = tenants.map((t) => t.id);
  const stats = getDistrictStats(tenantIds);
  const staff = await listMembersByRole(tenantIds, ["district_admin", "school_admin", "teacher"]);
  const pendingInvites = listStaffInvitesForTenants(tenantIds).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    displayName: i.displayName,
    invitedAt: i.invitedAt,
    schoolId: i.schoolId,
  }));
  const schools = tenants
    .filter((t) => t.type === "school")
    .map((t) => ({ id: t.id, name: t.name }));

  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District admin"
        title="Staff directory"
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

      <SectionHeader title="Invitations" />
      <StaffInviteSection schools={schools} pendingInvites={pendingInvites} />

      <SectionHeader title="Active staff" />
      <Card className="overflow-hidden">
        <div className="border-b border-aivo-border px-4 py-3">
          <p className="text-sm font-medium">
            {staff.length} {staff.length === 1 ? "person" : "people"}
          </p>
        </div>
        {staff.length === 0 ? (
          <EmptyState title="No staff in this district yet" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-aivo-muted">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Site</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Joined</th>
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

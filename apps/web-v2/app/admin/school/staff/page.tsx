import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import { listUsersForTenants, scopeTenantsForSession } from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["school_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const tenantMap = new Map(tenants.map((t) => [t.id, t]));
  const allStaff = await listUsersForTenants(tenants.map((t) => t.id));
  const staff = allStaff.filter((u) => u.role !== "parent" && u.role !== "learner");

  return (
    <AppShell
      role="school_admin"
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="School admin"
        title="Staff"
        description="Teachers and admins assigned to this school."
      />
      {staff.length === 0 ? (
        <EmptyState title="No staff yet" />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Tenant</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u.user.id} className="border-t border-aivo-border">
                  <td className="p-3 font-medium">{u.user.displayName}</td>
                  <td className="p-3 text-aivo-ink-soft">{u.user.email}</td>
                  <td className="p-3">
                    <Badge tone="primary">{u.role}</Badge>
                  </td>
                  <td className="p-3 text-aivo-ink-soft">
                    {tenantMap.get(u.tenantId)?.name ?? u.tenantId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}

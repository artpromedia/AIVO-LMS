import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import {
  scopeTenantsForSession,
  listMembersByRole,
  getTenantById,
} from "@/lib/db/repos";

const ROLE_LABEL: Record<string, string> = {
  district_admin: "District admin",
  school_admin: "School admin",
};

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const tenantIds = tenants.map((t) => t.id);
  const admins = listMembersByRole(tenantIds, [
    "district_admin",
    "school_admin",
  ]);

  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District settings"
        title="Admins"
        description="Every district and school administrator with access to this district."
      />

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-aivo-border px-4 py-3">
          <p className="text-sm font-medium">
            {admins.length} {admins.length === 1 ? "administrator" : "administrators"}
          </p>
          <p className="text-xs text-aivo-ink-soft">
            Inviting admins is handled by your district&rsquo;s onboarding contact at AIVO.
          </p>
        </div>
        {admins.length === 0 ? (
          <EmptyState title="No administrators yet" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-aivo-muted">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Scope</th>
                <th className="px-4 py-2">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aivo-border">
              {admins.map((a) => {
                const tenant = getTenantById(a.tenantId);
                const scopeLabel = tenant
                  ? `${tenant.name} · ${tenant.type}`
                  : a.tenantId;
                return (
                  <tr key={`${a.user.id}-${a.tenantId}`}>
                    <td className="px-4 py-3 font-medium">
                      {a.user.displayName}
                    </td>
                    <td className="px-4 py-3 text-aivo-ink-soft">
                      {a.user.email}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={a.role === "district_admin" ? "primary" : "neutral"}
                      >
                        {ROLE_LABEL[a.role] ?? a.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-aivo-ink-soft">
                      {scopeLabel}
                    </td>
                    <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                      {new Date(a.joinedAt).toLocaleDateString()}
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

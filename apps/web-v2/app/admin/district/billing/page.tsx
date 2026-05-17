import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import {
  listBillingForTenants,
  scopeTenantsForSession,
  getTenantById,
} from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const accounts = listBillingForTenants(tenants.map((t) => t.id));

  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District admin"
        title="Billing"
        description="Plan and payment status across schools and families in the district."
      />
      {accounts.length === 0 ? (
        <EmptyState title="No billing on file" />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left">
              <tr>
                <th className="p-3">Tenant</th>
                <th className="p-3">Type</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const t = getTenantById(a.tenantId);
                return (
                  <tr key={a.id} className="border-t border-aivo-border">
                    <td className="p-3 font-medium">{t?.name ?? a.tenantId}</td>
                    <td className="p-3 text-aivo-ink-soft">{t?.type ?? "?"}</td>
                    <td className="p-3 text-aivo-ink-soft">{a.plan}</td>
                    <td className="p-3">
                      <Badge tone={a.status === "active" ? "success" : a.status === "past_due" ? "danger" : "warning"}>
                        {a.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}

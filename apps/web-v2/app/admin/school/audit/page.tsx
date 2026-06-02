import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import { listAuditLogsForTenants, getTenantById, scopeTenantsForSession } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);

  // Scope to only this school's tenants
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const logs = await listAuditLogsForTenants(
    tenants.map((t) => t.id),
    100,
  );

  return (
    <AppShell
      role={session.role}
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="School admin"
        title="Audit log"
        description="Recent privileged actions scoped to this school. Newest first."
      />
      {logs.length === 0 ? (
        <EmptyState
          title="No audit events yet"
          description="Events will appear here as admins take actions."
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Action</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Tenant</th>
                <th className="p-3">Request ID</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-aivo-border">
                  <td className="p-3 text-aivo-ink-soft whitespace-nowrap">
                    {new Date(l.occurredAt).toLocaleString()}
                  </td>
                  <td className="p-3 font-medium">{l.action}</td>
                  <td className="p-3 text-xs text-aivo-muted">{l.userId ?? "—"}</td>
                  <td className="p-3 text-aivo-ink-soft">
                    {l.tenantId ? (getTenantById(l.tenantId)?.name ?? l.tenantId) : "—"}
                  </td>
                  <td className="p-3 font-mono text-xs text-aivo-muted">{l.requestId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}

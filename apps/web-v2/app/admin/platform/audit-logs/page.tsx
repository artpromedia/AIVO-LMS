import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import {
  listAuditLogsForTenants,
  scopeTenantsForSession,
  getTenantById,
} from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const logs = listAuditLogsForTenants(tenants.map((t) => t.id), 200);

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Observability"
        title="Audit logs"
        description="Every privileged or state-changing BFF call. Newest first."
      />
      {logs.length === 0 ? (
        <EmptyState title="No audit events yet" />
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
                  <td className="p-3 text-aivo-ink-soft">
                    {new Date(l.occurredAt).toLocaleString()}
                  </td>
                  <td className="p-3 font-medium">{l.action}</td>
                  <td className="p-3 text-xs text-aivo-muted">
                    {l.userId ?? "—"}
                  </td>
                  <td className="p-3 text-aivo-ink-soft">
                    {l.tenantId
                      ? (getTenantById(l.tenantId)?.name ?? l.tenantId)
                      : "—"}
                  </td>
                  <td className="p-3 font-mono text-xs text-aivo-muted">
                    {l.requestId}
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

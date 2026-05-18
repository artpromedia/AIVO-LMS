import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listBillingForTenants, scopeTenantsForSession, getTenantById } from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const accounts = listBillingForTenants(tenants.map((t) => t.id));
  const counts = accounts.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Billing"
        title="Billing"
        description="Every billing account on the platform."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {["trialing", "active", "past_due", "canceled"].map((k) => (
          <Card key={k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">{k}</p>
            <p className="mt-1 font-display text-3xl font-bold">{counts[k] ?? 0}</p>
          </Card>
        ))}
      </div>
      {accounts.length === 0 ? (
        <EmptyState title="No billing accounts" />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left">
              <tr>
                <th className="p-3">Tenant</th>
                <th className="p-3">Type</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
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
                      <Badge
                        tone={
                          a.status === "active"
                            ? "success"
                            : a.status === "past_due"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {a.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-aivo-ink-soft">
                      {new Date(a.createdAt).toLocaleDateString()}
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

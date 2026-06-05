import { Permission } from "@aivo/security";
import { requirePlatformPage } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { platformNavForSession } from "@/components/layout/role-shells";
import { listAuditLogsForTenants, scopeTenantsForSession, getTenantById } from "@/lib/db/repos";
import { ROLE_LABEL } from "@/lib/auth/types";

export default async function Page() {
  const session = await requirePlatformPage(Permission.AuditRead);
  const t = await getTranslations("admin.platform_audit_logs");
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const logs = await listAuditLogsForTenants(
    tenants.map((t) => t.id),
    200,
  );

  return (
    <AppShell
      role={session.role}
      roleLabel={ROLE_LABEL[session.role]}
      navItems={platformNavForSession(session)}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Observability"
        title={t("title")}
        description="Every privileged or state-changing BFF call. Newest first."
      />
      {logs.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">{t("col_action")}</th>
                <th className="p-3">Actor</th>
                <th className="p-3">{t("col_tenant")}</th>
                <th className="p-3">{t("col_request_id")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-aivo-border">
                  <td className="p-3 text-aivo-ink-soft">
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

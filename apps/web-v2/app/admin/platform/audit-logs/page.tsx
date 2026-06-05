import { Permission } from "@aivo/security";
import { requirePlatformPage } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { platformNavForSession } from "@/components/layout/role-shells";
import { listAdminAuditLogs } from "@/lib/admin-api/audit";
import { ROLE_LABEL } from "@/lib/auth/types";

export default async function Page() {
  const session = await requirePlatformPage(Permission.AuditRead);
  const t = await getTranslations("admin.platform_audit_logs");
  const logs = await listAdminAuditLogs(session, 200);

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
        description="Append-only admin audit entries from admin-svc. Newest first."
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
                <th className="p-3">Resource</th>
                <th className="p-3">{t("col_tenant")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-aivo-border">
                  <td className="p-3 text-aivo-ink-soft">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3 font-medium">{log.action}</td>
                  <td className="p-3 text-xs text-aivo-muted">
                    <div>{log.actorEmail || log.actorId}</div>
                    <div>{log.actorRoleLabel}</div>
                  </td>
                  <td className="p-3 text-aivo-ink-soft">
                    {log.resourceType}
                    {log.resourceId ? ` · ${log.resourceId}` : ""}
                  </td>
                  <td className="p-3 font-mono text-xs text-aivo-muted">
                    {log.tenantId ?? "—"}
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

import { Permission } from "@aivo/security";
import { requirePlatformPage } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { platformNavForSession } from "@/components/layout/role-shells";
import { listSupportTickets, scopeTenantsForSession, getTenantById } from "@/lib/db/repos";
import { getStore } from "@/lib/db/store";
import { ROLE_LABEL } from "@/lib/auth/types";

const TONE: Record<string, "warning" | "primary" | "success"> = {
  open: "warning",
  in_progress: "primary",
  resolved: "success",
};

export default async function Page() {
  const session = await requirePlatformPage(Permission.SupportRead);
  const t = await getTranslations("admin.platform_support");
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const tickets = listSupportTickets(tenants.map((t) => t.id));
  const users = getStore().users;

  return (
    <AppShell
      role={session.role}
      roleLabel={ROLE_LABEL[session.role]}
      navItems={platformNavForSession(session)}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Support"
        title={t("title")}
        description="Inbound requests from parents, teachers, and admins."
      />
      {tickets.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id} className="p-[var(--aivo-density-card-pad)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold">{t.subject}</p>
                  <p className="text-xs text-aivo-muted">
                    From {users.get(t.userId)?.displayName ?? t.userId} ·{" "}
                    {getTenantById(t.tenantId)?.name ?? t.tenantId} ·{" "}
                    {new Date(t.createdAt).toLocaleString()}
                  </p>
                </div>
                <Badge tone={TONE[t.status] ?? "neutral"}>{t.status}</Badge>
              </div>
              <p className="mt-3 text-sm text-aivo-ink-soft">{t.body}</p>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

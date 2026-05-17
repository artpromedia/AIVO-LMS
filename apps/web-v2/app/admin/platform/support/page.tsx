import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import {
  listSupportTickets,
  scopeTenantsForSession,
  getTenantById,
} from "@/lib/db/repos";
import { getStore } from "@/lib/db/store";

const TONE: Record<string, "warning" | "primary" | "success"> = {
  open: "warning",
  in_progress: "primary",
  resolved: "success",
};

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const tickets = listSupportTickets(tenants.map((t) => t.id));
  const users = getStore().users;

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Support"
        title="Support tickets"
        description="Inbound requests from parents, teachers, and admins."
      />
      {tickets.length === 0 ? (
        <EmptyState title="Inbox is empty" />
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id} className="p-[var(--aivo-density-card-pad)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold">
                    {t.subject}
                  </p>
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

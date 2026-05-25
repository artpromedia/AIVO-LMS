import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { listNotifications } from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["learner"]);
  const t = await getTranslations("learner.notifications");
  const notifications = listNotifications({ tenantId: session.tenantId, userId: session.userId });

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader eyebrow="You" title={t("page_title")} description={t("description")} />
      {notifications.length === 0 ? (
        <EmptyState title={t("empty_state")} description="No new messages right now." />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card key={n.id} className={`p-4 ${n.readAt ? "opacity-70" : ""}`}>
              <div className="flex items-center gap-2">
                <p className="font-medium">{n.title}</p>
                {!n.readAt ? <Badge tone="primary">New</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-aivo-ink-soft">{n.body}</p>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

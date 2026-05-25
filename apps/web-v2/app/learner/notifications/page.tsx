import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { listNotifications } from "@/lib/db/repos";
import { NotificationsList } from "./notifications-list";

export default async function Page() {
  const session = await requirePageRole(["learner"]);
  const t = await getTranslations("learner.notifications");
  const notifications = listNotifications({ tenantId: session.tenantId, userId: session.userId });

  // Sprint 10 — server renders the initial list (SEO + first paint),
  // then the client list hydrates and subscribes to live updates via
  // useNotificationStream (polling fallback today; SSE when
  // services/comms-svc /stream lands).
  const initial = notifications.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    readAt: n.readAt ?? null,
    createdAt: n.createdAt,
  }));

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader eyebrow="You" title={t("page_title")} description={t("description")} />
      <NotificationsList
        fetchUrl="/api/bff/learners/notifications"
        markReadUrl="/api/bff/learners/notifications/mark-read"
        initial={initial}
        emptyTitle={t("empty_state")}
        emptyDescription="No new messages right now."
      />
    </AppShell>
  );
}

import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PARENT_NAV } from "@/components/layout/role-shells";
import {
  getNotificationPreference,
  listNotifications,
} from "@/lib/db/repos";
import { NotificationList } from "./notification-list";
import { PreferencesForm } from "./preferences-form";

export default async function Page() {
  const session = await requirePageRole(["parent"]);
  const notifications = listNotifications({ tenantId: session.tenantId, userId: session.userId });
  const pref = getNotificationPreference(session.userId, session.tenantId);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Parent"
        title="Notifications"
        description="Updates about your learners' progress, assignments, and account."
      />

      <SectionHeader title="Inbox" description="Tap to mark as read. Unread items are highlighted." />
      {notifications.length === 0 ? (
        <EmptyState title="No notifications yet" description="You'll see updates here when activity occurs." />
      ) : (
        <NotificationList notifications={notifications} />
      )}

      <SectionHeader className="mt-10" title="Delivery preferences" description="Choose which updates reach you on each channel." />
      <Card className="p-[var(--aivo-density-card-pad)]">
        <PreferencesForm preference={pref} />
      </Card>
    </AppShell>
  );
}

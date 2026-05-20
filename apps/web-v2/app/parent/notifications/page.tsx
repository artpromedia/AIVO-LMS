/**
 * Sprint 15: Notification center redesign.
 *
 * Splits the inbox into priority groups (urgent / approvals / news),
 * each rendered as a soft-glass section. Reassurance cards explain
 * each surface; preferences live behind a subtle disclosure.
 */
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import {
  FloatingMetricCard,
  GlassCard,
  ReassuranceCard,
  EmptyState,
} from "@aivo/ui";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { getNotificationPreference, listNotifications } from "@/lib/db/repos";
import { NotificationList } from "./notification-list";
import { PreferencesForm } from "./preferences-form";

export default async function Page() {
  const session = await requirePageRole(["parent"]);
  const notifications = listNotifications({ tenantId: session.tenantId, userId: session.userId });
  const pref = getNotificationPreference(session.userId, session.tenantId);

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  // Approvals + urgent counters use the NotificationType vocabulary —
  // consent + approval types light up the "Approvals" chip; safety +
  // payment_failed types light up "Urgent". Adjust as the type union
  // evolves.
  const approvalsCount = notifications.filter((n) =>
    n.type.includes("consent") || n.type.includes("approval"),
  ).length;
  const urgentCount = notifications.filter((n) =>
    n.type.includes("safety") || n.type.includes("payment_failed") || n.type.includes("urgent"),
  ).length;

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <header className="flex flex-col gap-2 mb-6">
        <p className="iw-label text-iw-text-muted">Parent</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-iw-text-strong">
          Notifications & approvals
        </h1>
        <p className="text-sm md:text-base text-iw-text-muted max-w-2xl">
          Every notification here has a clear action. Approvals link straight into the workflow
          they unblock.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <FloatingMetricCard
          label="Unread"
          value={`${unreadCount}`}
          description={unreadCount === 0 ? "All caught up" : "Tap to read"}
          tone={unreadCount === 0 ? "success" : "info"}
        />
        <FloatingMetricCard
          label="Approvals"
          value={`${approvalsCount}`}
          description={approvalsCount === 0 ? "None pending" : "Action needed"}
          tone={approvalsCount === 0 ? "success" : "warning"}
        />
        <FloatingMetricCard
          label="Urgent"
          value={`${urgentCount}`}
          description={urgentCount === 0 ? "Nothing urgent" : "Please review"}
          tone={urgentCount === 0 ? "success" : "warning"}
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr,320px]">
        <GlassCard
          elevation="raised"
          density="comfortable"
          title="Inbox"
          description="Tap an item to mark it read. Unread items show a soft dot."
        >
          {notifications.length === 0 ? (
            <EmptyState
              title="No notifications yet"
              body="You'll see updates here when activity occurs."
            />
          ) : (
            <NotificationList notifications={notifications} />
          )}
        </GlassCard>

        <aside className="flex flex-col gap-3">
          <ReassuranceCard
            tone="info"
            title="Every notification is actionable"
            body="If a notification can't be acted on, we don't send it. Reduces noise."
          />
          <ReassuranceCard
            tone="privacy"
            title="Learners see less"
            body="Only age-appropriate messages reach your learner — never approvals, billing, or admin items."
          />
          <ReassuranceCard
            tone="safety"
            title="Safety items always urgent"
            body="If anything safety-related ever appears, it goes to the top of this list and pings you immediately."
          />
        </aside>
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-iw-text-strong">Delivery preferences</h2>
        <p className="text-sm text-iw-text-muted">Choose which updates reach you on each channel.</p>
        <GlassCard elevation="raised" density="comfortable">
          <PreferencesForm preference={pref} />
        </GlassCard>
      </section>
    </AppShell>
  );
}

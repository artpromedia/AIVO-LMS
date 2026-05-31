/**
 * Sprint 15: Notification center redesign.
 *
 * Splits the inbox into priority groups (urgent / approvals / news),
 * each rendered as a soft-glass section. Reassurance cards explain
 * each surface; preferences live behind a subtle disclosure.
 */
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("parent.notifications");
  const notifications = await listNotifications({
    tenantId: session.tenantId,
    userId: session.userId,
  });
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
        <p className="iw-label text-iw-text-muted">{t("eyebrow")}</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-iw-text-strong">
          {t("title")}
        </h1>
        <p className="text-sm md:text-base text-iw-text-muted max-w-2xl">
          {t("description")}
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <FloatingMetricCard
          label={t("unread_label")}
          value={`${unreadCount}`}
          description={unreadCount === 0 ? t("unread_zero") : t("unread_some")}
          tone={unreadCount === 0 ? "success" : "info"}
        />
        <FloatingMetricCard
          label={t("approvals_label")}
          value={`${approvalsCount}`}
          description={approvalsCount === 0 ? t("approvals_zero") : t("approvals_some")}
          tone={approvalsCount === 0 ? "success" : "warning"}
        />
        <FloatingMetricCard
          label={t("urgent_label")}
          value={`${urgentCount}`}
          description={urgentCount === 0 ? t("urgent_zero") : t("urgent_some")}
          tone={urgentCount === 0 ? "success" : "warning"}
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr,320px]">
        <GlassCard
          elevation="raised"
          density="comfortable"
          title={t("inbox_title")}
          description={t("inbox_desc")}
        >
          {notifications.length === 0 ? (
            <EmptyState
              title={t("empty_title")}
              body={t("empty_body")}
            />
          ) : (
            <NotificationList notifications={notifications} />
          )}
        </GlassCard>

        <aside className="flex flex-col gap-3">
          <ReassuranceCard
            tone="info"
            title={t("reassure_actionable_title")}
            body={t("reassure_actionable_body")}
          />
          <ReassuranceCard
            tone="privacy"
            title={t("reassure_learners_title")}
            body={t("reassure_learners_body")}
          />
          <ReassuranceCard
            tone="safety"
            title={t("reassure_safety_title")}
            body={t("reassure_safety_body")}
          />
        </aside>
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-iw-text-strong">{t("prefs_title")}</h2>
        <p className="text-sm text-iw-text-muted">{t("prefs_desc")}</p>
        <GlassCard elevation="raised" density="comfortable">
          <PreferencesForm preference={pref} />
        </GlassCard>
      </section>
    </AppShell>
  );
}

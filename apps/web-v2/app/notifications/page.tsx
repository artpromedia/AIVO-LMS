/**
 * Top-level Notifications surface — ADR 0020 Phase 2, slice 1.
 *
 * The notifications experience used to live behind per-role routes
 * (`/learner/notifications`, `/parent/notifications`, …). Per
 * `CROSS_CUTTING_REGISTRY.notifications` (`@aivo/nav`), it now lives
 * at the canonical top-level path `/notifications` and reads the
 * server-authoritative `activeRole` from the session to decide how
 * to render itself.
 *
 * Access is gated by `<RoleGate area="messages">` so the four
 * outcomes (`allow` / `switch-role` / `locked` / `forbidden`) match
 * exactly what every other shell consumer of `canAccessArea`
 * produces — no parallel RBAC table. The `messages` anchor is
 * pinned by `CROSS_CUTTING_REGISTRY.notifications.navArea`.
 */
import { getTranslations } from "next-intl/server";
import {
  FloatingMetricCard,
  GlassCard,
  ReassuranceCard,
  EmptyState as UiEmptyState,
} from "@aivo/ui";
import { requirePageRole } from "@/lib/auth/server";
import { buildRoleSession } from "@/lib/auth/role-session";
import { ROLE_LABEL, type Role } from "@/lib/auth/types";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { RoleGate } from "@/components/auth/role-gate";
import { LEARNER_NAV, PARENT_NAV, TEACHER_NAV } from "@/components/layout/role-shells";
import { getNotificationPreference, listNotifications } from "@/lib/db/repos";
import { ParentNotificationList } from "./_components/parent-notification-list";
import { ParentPreferencesForm } from "./_components/parent-preferences-form";
import { LearnerNotificationsList } from "./_components/learner-notifications-list";

const ALL_ROLES: Role[] = [
  "parent",
  "learner",
  "teacher",
  "caregiver",
  "therapist",
  "school_admin",
  "district_admin",
  "platform_admin",
];

const ROLE_NAV = {
  parent: PARENT_NAV,
  learner: LEARNER_NAV,
  teacher: TEACHER_NAV,
} as const;

const PATHNAME = "/notifications";

export default async function Page() {
  // Authenticated, but role-agnostic — `/notifications` is the same
  // entry point for every role. `requirePageRole` is reused so the
  // `scripts/route-audit.mjs` auth-helper scan still recognises the
  // page as making an explicit auth choice.
  const session = await requirePageRole(ALL_ROLES);
  const roleSession = buildRoleSession(session);

  // Server-render the initial inbox; the client list hydrates and
  // subscribes to live updates via /api/bff/notifications/stream.
  const notifications = await listNotifications({
    tenantId: session.tenantId,
    userId: session.userId,
  });

  // Pick the shell nav for the active role so the sidebar / tabbar
  // stays consistent with where the user came from. Roles without a
  // bespoke nav array fall back to a minimal shell (no nav rail);
  // the page itself stays usable.
  const navItems = ROLE_NAV[session.role as keyof typeof ROLE_NAV] ?? [];
  const roleLabel = ROLE_LABEL[session.role];

  const body =
    session.role === "parent" ? (
      <ParentView session={session} notifications={notifications} />
    ) : session.role === "learner" ? (
      <LearnerView notifications={notifications} />
    ) : (
      <GenericView roleLabel={roleLabel} notifications={notifications} />
    );

  return (
    <AppShell
      role={session.role}
      roleLabel={roleLabel}
      navItems={navItems}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <RoleGate session={roleSession} area="messages" pathname={PATHNAME}>
        {body}
      </RoleGate>
    </AppShell>
  );
}

/* ──────────────────────────── Parent view ─────────────────────────── */

async function ParentView({
  session,
  notifications,
}: {
  session: Awaited<ReturnType<typeof requirePageRole>>;
  notifications: Awaited<ReturnType<typeof listNotifications>>;
}) {
  const t = await getTranslations("parent.notifications");
  const pref = getNotificationPreference(session.userId, session.tenantId);

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  // Approvals + urgent counters use the NotificationType vocabulary —
  // consent + approval types light up the "Approvals" chip; safety +
  // payment_failed types light up "Urgent". Mirrors the legacy
  // /parent/notifications categorisation so behaviour is preserved.
  const approvalsCount = notifications.filter(
    (n) => n.type.includes("consent") || n.type.includes("approval"),
  ).length;
  const urgentCount = notifications.filter(
    (n) =>
      n.type.includes("safety") || n.type.includes("payment_failed") || n.type.includes("urgent"),
  ).length;

  return (
    <>
      <header className="flex flex-col gap-2 mb-6">
        <p className="iw-label text-iw-text-muted">{t("eyebrow")}</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-iw-text-strong">{t("title")}</h1>
        <p className="text-sm md:text-base text-iw-text-muted max-w-2xl">{t("description")}</p>
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
            <UiEmptyState title={t("empty_title")} body={t("empty_body")} />
          ) : (
            <ParentNotificationList notifications={notifications} />
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
          <ParentPreferencesForm preference={pref} />
        </GlassCard>
      </section>
    </>
  );
}

/* ──────────────────────────── Learner view ────────────────────────── */

async function LearnerView({
  notifications,
}: {
  notifications: Awaited<ReturnType<typeof listNotifications>>;
}) {
  const t = await getTranslations("learner.notifications");

  const initial = notifications.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    readAt: n.readAt ?? null,
    createdAt: n.createdAt,
  }));

  return (
    <>
      <PageHeader eyebrow="You" title={t("page_title")} description={t("description")} />
      <LearnerNotificationsList
        fetchUrl="/api/bff/notifications"
        markReadUrl="/api/bff/notifications/mark-read"
        sseUrl="/api/bff/notifications/stream"
        initial={initial}
        emptyTitle={t("empty_state")}
        emptyDescription="No new messages right now."
      />
    </>
  );
}

/* ──────────────── Generic view (teacher / admin / care) ───────────── */

async function GenericView({
  roleLabel,
  notifications,
}: {
  roleLabel: string;
  notifications: Awaited<ReturnType<typeof listNotifications>>;
}) {
  // Generic role view re-uses the learner client list (which already
  // wires SSE + mark-read against the role-agnostic BFF). Copy is
  // intentionally minimal so we don't fork i18n catalogs for roles
  // that didn't previously have a dedicated notifications page; the
  // BFF returns the same per-user inbox regardless of role.
  const initial = notifications.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    readAt: n.readAt ?? null,
    createdAt: n.createdAt,
  }));

  return (
    <>
      <PageHeader
        eyebrow={roleLabel}
        title="Notifications"
        description="Updates from AIVO and your team."
      />
      <LearnerNotificationsList
        fetchUrl="/api/bff/notifications"
        markReadUrl="/api/bff/notifications/mark-read"
        sseUrl="/api/bff/notifications/stream"
        initial={initial}
        emptyTitle="You're all caught up"
        emptyDescription="No new messages right now."
      />
    </>
  );
}

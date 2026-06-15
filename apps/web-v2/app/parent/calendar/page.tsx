import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { listLearnersForParent } from "@/lib/db/repos";
import { getCalendarEvents } from "@/lib/parent/calendar";
import { CalendarView } from "./calendar-view";

export const dynamic = "force-dynamic";

export default async function Page() {
  const t = await getTranslations("parent.calendar");
  const session = await requirePageRole(["parent"]);
  const learners = await listLearnersForParent(session.userId, session.tenantId);
  const events = await getCalendarEvents({
    parentUserId: session.userId,
    tenantId: session.tenantId,
    titles: { assignment: t("untitled_assignment"), lesson: t("lesson_title") },
  });
  // Server-provided "today" so SSR and client hydration agree on the highlight.
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader eyebrow="Parent" title={t("title")} description={t("description")} />
      {learners.length === 0 ? (
        <EmptyState title={t("no_learners_title")} description={t("no_learners_body")} />
      ) : (
        <CalendarView
          events={events}
          learners={learners.map((l) => ({ id: l.id, displayName: l.displayName }))}
          todayKey={todayKey}
        />
      )}
    </AppShell>
  );
}

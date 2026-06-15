import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { SectionCard } from "../home-v2/_components/SectionCard";
import {
  listLearnersForParent,
  listActiveAssignmentsForLearner,
  listLessonRunsForLearner,
  listSubjects,
} from "@/lib/db/repos";

/**
 * Parent → Calendar (Wave 2), built over the same real data as /parent/schedule.
 *
 * Agenda-style view: teacher assignments grouped by their real `dueAt` day, plus
 * an "in progress now" group for active AI lessons (which have no scheduled date)
 * and a "no due date" group. No fabricated calendar entries — every item traces to
 * a real `teacher_assignments` or `lesson_runs` row.
 */

type AssignmentEvent = {
  id: string;
  learnerName: string;
  title: string;
  subject: string;
  dueAt: string | null;
};

type ActiveEvent = {
  id: string;
  learnerName: string;
  subject: string;
  inProgress: boolean;
};

function dayKey(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

export default async function Page() {
  const t = await getTranslations("parent.calendar");
  const locale = await getLocale();
  const session = await requirePageRole(["parent"]);
  const learners = await listLearnersForParent(session.userId, session.tenantId);
  const subjectMap = new Map((await listSubjects()).map((s) => [s.id, s]));

  const assignmentEvents: AssignmentEvent[] = [];
  const activeEvents: ActiveEvent[] = [];

  for (const l of learners) {
    const assignments = await listActiveAssignmentsForLearner(l.id, session.tenantId);
    for (const a of assignments) {
      assignmentEvents.push({
        id: a.id,
        learnerName: l.displayName,
        title: a.title,
        subject: subjectMap.get(a.subjectId)?.name ?? "",
        dueAt: a.dueAt ?? null,
      });
    }
    const runs = await listLessonRunsForLearner(l.id, session.tenantId);
    for (const r of runs.filter((r) => r.status === "ready" || r.status === "in_progress")) {
      activeEvents.push({
        id: r.id,
        learnerName: l.displayName,
        subject: subjectMap.get(r.subjectId)?.name ?? t("ai_lesson"),
        inProgress: r.status === "in_progress",
      });
    }
  }

  const withDue = assignmentEvents
    .filter((e) => e.dueAt)
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
  const noDue = assignmentEvents.filter((e) => !e.dueAt);

  const groups = new Map<string, AssignmentEvent[]>();
  for (const e of withDue) {
    const key = dayKey(e.dueAt as string);
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }

  const isEmpty =
    learners.length === 0 ||
    (withDue.length === 0 && noDue.length === 0 && activeEvents.length === 0);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader eyebrow="Parent" title={t("title")} description={t("subtitle")} />

      {learners.length === 0 ? (
        <EmptyState title={t("no_learners_title")} description={t("no_learners_desc")} />
      ) : isEmpty ? (
        <EmptyState title={t("nothing_scheduled_title")} description={t("nothing_scheduled_desc")} />
      ) : (
        <div className="flex flex-col gap-8">
          {activeEvents.length > 0 ? (
            <SectionCard title={t("in_progress_now")} iconName="aiSparkle">
              <ul className="flex flex-col gap-2">
                {activeEvents.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-3 rounded-iw-control border border-iw-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{e.subject}</p>
                      <p className="text-xs text-iw-text-muted">
                        {e.learnerName} · {e.inProgress ? t("in_progress_lesson") : t("ready")}
                      </p>
                    </div>
                    <Link
                      href={`/learner/lesson-runs/${e.id}`}
                      className="shrink-0 text-xs font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
                    >
                      {t("open")}
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          {[...groups.entries()].map(([key, items]) => (
            <section key={key}>
              <SectionHeader
                title={new Date(`${key}T00:00:00`).toLocaleDateString(locale, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
                description={`${items.length} ${items.length === 1 ? t("item_one") : t("item_other")}`}
              />
              <div className="grid gap-3">
                {items.map((e) => (
                  <Card key={e.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{e.title}</p>
                        <p className="text-sm text-aivo-ink-soft">
                          {e.learnerName}
                          {e.subject ? ` · ${e.subject}` : ""}
                        </p>
                      </div>
                      <Badge tone="primary">{t("teacher_assignment")}</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))}

          {noDue.length > 0 ? (
            <section>
              <SectionHeader title={t("no_due_date")} />
              <div className="grid gap-3">
                {noDue.map((e) => (
                  <Card key={e.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{e.title}</p>
                        <p className="text-sm text-aivo-ink-soft">
                          {e.learnerName}
                          {e.subject ? ` · ${e.subject}` : ""}
                        </p>
                      </div>
                      <Badge tone="primary">{t("teacher_assignment")}</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}

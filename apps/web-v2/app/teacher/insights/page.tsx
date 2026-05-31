import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TEACHER_NAV } from "@/components/layout/role-shells";
import {
  listLearnersForTeacher,
  listLessonRunsForLearner,
  listSkills,
  listSubjects,
} from "@/lib/db/repos";
import { getStore } from "@/lib/db/store";

export default async function Page() {
  const t = await getTranslations("teacher.insights");
  const session = await requirePageRole(["teacher"]);
  const learners = await listLearnersForTeacher(session.userId, session.tenantId);
  const subjectMap = new Map((await listSubjects()).map((s) => [s.id, s]));
  const skillMap = new Map((await listSkills()).map((s) => [s.id, s]));

  return (
    <AppShell
      role="teacher"
      roleLabel="Teacher"
      navItems={TEACHER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Teacher"
        title={t("title")}
        description="Recent mastery and lesson activity across your roster."
      />
      {learners.length === 0 ? (
        <EmptyState
          title={t("empty_title")}
          description="Once learners are rostered, their skill mastery and lesson activity will appear here."
        />
      ) : (
        <div className="space-y-4">
          {await Promise.all(
            learners.map(async (l) => {
              const runs = await listLessonRunsForLearner(l.id, session.tenantId);
              const completed = runs.filter((r) => r.status === "completed").length;
            const masteries = getStore()
              .skillMasteries.filter((m) => m.learnerId === l.id)
              .sort((a, b) => b.score - a.score)
              .slice(0, 5);
            return (
              <Card key={l.id} className="p-[var(--aivo-density-card-pad)]">
                <div className="flex items-center justify-between">
                  <p className="font-display text-lg font-semibold">{l.displayName}</p>
                  <p className="text-sm text-aivo-ink-soft">
                    {completed} of {runs.length} lessons complete
                  </p>
                </div>
                {masteries.length === 0 ? (
                  <p className="mt-3 text-sm text-aivo-ink-soft">
                    No mastery scores recorded yet — encourage {l.displayName} to start a lesson.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-1 text-sm">
                    {masteries.map((m) => {
                      const skill = skillMap.get(m.skillId);
                      const subject = skill ? subjectMap.get(skill.subjectId) : null;
                      return (
                        <li key={m.skillId} className="flex items-center justify-between">
                          <span>
                            {skill?.name ?? m.skillId}
                            {subject ? (
                              <span className="ml-2 text-xs text-aivo-muted">{subject.name}</span>
                            ) : null}
                          </span>
                          <span className="font-medium">{Math.round(m.score * 100)}%</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            );
            }),
          )}
        </div>
      )}
    </AppShell>
  );
}

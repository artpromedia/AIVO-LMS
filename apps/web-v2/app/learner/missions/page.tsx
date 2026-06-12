import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AivoMascot } from "@/components/learner/art/aivo-mascot";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import {
  listActiveAssignmentsForLearner,
  listLessonRunsForLearner,
  listSubjects,
} from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["learner"]);
  const t = await getTranslations("learner.missions");
  const tc = await getTranslations("learner.common");
  const learnerId = session.learnerId;
  if (!learnerId) {
    return (
      <AppShell
        role="learner"
        roleLabel="Learner"
        navItems={LEARNER_NAV}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <EmptyState title={tc("no_profile")} />
      </AppShell>
    );
  }
  const subjectMap = new Map((await listSubjects()).map((s) => [s.id, s]));
  const assignments = await listActiveAssignmentsForLearner(learnerId, session.tenantId);
  const allRuns = await listLessonRunsForLearner(learnerId, session.tenantId);
  const runs = allRuns.filter((r) => r.status === "ready" || r.status === "in_progress");

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={tc("learner_eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      <div className="space-y-3">
        {assignments.map((a) => (
          <Card key={a.id} className="p-4">
            <p className="font-medium">{a.title}</p>
            <p className="text-sm text-aivo-ink-soft">
              {t("from_teacher", {
                subject: subjectMap.get(a.subjectId)?.name ?? t("subject_fallback"),
              })}
            </p>
          </Card>
        ))}
        {runs.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t("lesson_in_progress")}</p>
                <p className="text-sm text-aivo-ink-soft">{tc("source", { source: r.source })}</p>
              </div>
              <Link
                href={`/learner/lesson-runs/${r.id}`}
                className="text-xs font-medium text-aivo-primary hover:underline"
              >
                {t("continue")}
              </Link>
            </div>
          </Card>
        ))}
        {assignments.length === 0 && runs.length === 0 ? (
          <EmptyState
            icon={<AivoMascot expression="resting" size={72} />}
            title={t("nothing_waiting")}
            description={t("nothing_desc")}
            action={
              <Link
                href="/learner/home"
                className="text-sm font-medium text-aivo-primary hover:underline"
              >
                {t("go_today")}
              </Link>
            }
          />
        ) : null}
      </div>
    </AppShell>
  );
}

/**
 * Sprint 14: Parent · Progress page.
 *
 * Shows mastery overview by subject + lifetime stats. Reads directly from
 * repos (server component pattern used elsewhere in this app). The matching
 * BFF route `/api/bff/learners/:learnerId/progress` is available for the
 * mobile app and any future client refreshes.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  getLearner,
  getMasteryMap,
  listLessonRunsForLearner,
  listMasterySnapshots,
  listSkills,
  listSubjects,
  parentCanAccessLearner,
} from "@/lib/db/repos";
import { TrajectorySparkline } from "@/components/parent/trajectory-sparkline";
import { RefreshLearningPathButton } from "@/components/parent/refresh-learning-path-button";
import { normalizeGradeBand } from "@aivo/scoring";

export const dynamic = "force-dynamic";

export default async function ParentProgressPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  const t = await getTranslations("parent.learner_progress");
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  const { map, skillMasteries } = await getMasteryMap(learnerId, session.tenantId);
  const subjects = await listSubjects();
  const skills = await listSkills();
  const allRuns = await listLessonRunsForLearner(learnerId, session.tenantId);
  const completed = allRuns.filter((r) => r.status === "completed");
  const snapshots = await listMasterySnapshots(learnerId, session.tenantId);
  const snapshotsBySubject = new Map<string, typeof snapshots>();
  for (const snap of snapshots) {
    const list = snapshotsBySubject.get(snap.subjectId);
    if (list) list.push(snap);
    else snapshotsBySubject.set(snap.subjectId, [snap]);
  }

  const bySubject = subjects
    .map((subject) => {
      const subjectSkills = skills.filter((s) => s.subjectId === subject.id);
      const ms = skillMasteries.filter((m) => subjectSkills.some((s) => s.id === m.skillId));
      if (ms.length === 0) return null;
      const avg = ms.reduce((acc, m) => acc + m.score, 0) / ms.length;
      const mastered = ms.filter(
        (m) => m.level === "on_grade_level" || m.level === "stretching",
      ).length;
      return { subject, avg, mastered, total: ms.length, items: ms };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const totalMinutes = completed.reduce((acc, r) => {
    if (!r.completedAt || !r.startedAt) return acc;
    return (
      acc +
      Math.round((new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 60000)
    );
  }, 0);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={learner.displayName}
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex gap-2">
            <RefreshLearningPathButton
              learnerId={learnerId}
              labels={{
                idle: t("refresh_path"),
                done: t("refresh_path_done"),
                error: t("refresh_path_error"),
              }}
            />
            <Button asChild variant="outline">
              <Link href={`/parent/learners/${learnerId}/lessons`}>{t("lessons_link")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/parent/learners/${learnerId}/summary`}>{t("summary_link")}</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-iw-card-lg bg-white border border-iw-border p-4 shadow-soft-3">
          <p className="text-xs uppercase text-iw-text-muted">{t("lessons_done")}</p>
          <p className="text-2xl font-semibold text-iw-text-strong">{completed.length}</p>
        </div>
        <div className="rounded-iw-card-lg bg-white border border-iw-border p-4 shadow-soft-3">
          <p className="text-xs uppercase text-iw-text-muted">{t("time_learning")}</p>
          <p className="text-2xl font-semibold text-iw-text-strong">{totalMinutes} min</p>
        </div>
        <div className="rounded-iw-card-lg bg-white border border-iw-border p-4 shadow-soft-3">
          <p className="text-xs uppercase text-iw-text-muted">{t("skills_tracked")}</p>
          <p className="text-2xl font-semibold text-iw-text-strong">{skillMasteries.length}</p>
        </div>
        <div className="rounded-iw-card-lg bg-white border border-iw-border p-4 shadow-soft-3">
          <p className="text-xs uppercase text-iw-text-muted">{t("mastered")}</p>
          <p className="text-2xl font-semibold text-iw-text-strong">
            {
              skillMasteries.filter((m) => m.level === "on_grade_level" || m.level === "stretching")
                .length
            }
          </p>
        </div>
      </div>

      <SectionHeader
        className="mt-8"
        title={t("by_subject")}
        description={
          map
            ? `Last updated ${new Date(map.updatedAt).toLocaleDateString()}.`
            : "No mastery data yet."
        }
      />
      <div className="grid gap-4">
        {bySubject.length === 0 ? (
          <div className="rounded-iw-card-lg bg-white border border-iw-border p-6 text-sm text-iw-text-muted shadow-soft-3">
            Once {learner.displayName} completes a lesson, mastery shows up here.
          </div>
        ) : (
          bySubject.map(({ subject, avg, mastered, total, items }) => {
            const trajectory = snapshotsBySubject.get(subject.id) ?? [];
            const latest = trajectory.length > 0 ? trajectory[trajectory.length - 1]! : null;
            const deliveryBand = normalizeGradeBand(latest?.deliveryLevel);
            const enrolledBand = normalizeGradeBand(latest?.gradeBand);
            return (
            <div key={subject.id} className="rounded-iw-card-lg bg-white border border-iw-border p-5 sm:p-6 shadow-soft-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-iw-text-strong">{subject.name}</p>
                  <p className="text-sm text-iw-text-muted">
                    {mastered} of {total} skills mastered
                  </p>
                </div>
                <Badge tone={avg >= 0.75 ? "success" : avg >= 0.5 ? "primary" : "neutral"}>
                  {Math.round(avg * 100)}%
                </Badge>
              </div>
              <Progress
                className="mt-3"
                value={avg * 100}
                aria-label={`${Math.round(avg * 100)}%`}
              />
              {latest ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-iw-control border border-iw-border p-3">
                  <div className="text-sm">
                    <p className="text-xs uppercase text-iw-text-muted">
                      {t("trajectory_title")}
                    </p>
                    <p className="mt-1 text-iw-text-strong">
                      {t("at_grade_count", {
                        count: latest.skillsOnGradeLevel,
                        total: latest.skillsTotal,
                      })}
                    </p>
                    {deliveryBand && enrolledBand ? (
                      <p className="text-iw-text-muted">
                        {deliveryBand === enrolledBand
                          ? t("on_grade")
                          : `${t("working_at", { level: deliveryBand })} · ${t("grade_target", { grade: enrolledBand })}`}
                      </p>
                    ) : null}
                  </div>
                  <TrajectorySparkline snapshots={trajectory} label={subject.name} />
                </div>
              ) : null}
              <ul className="mt-4 grid gap-1 text-sm sm:grid-cols-2">
                {items.slice(0, 8).map((m) => {
                  const skill = skills.find((s) => s.id === m.skillId);
                  return (
                    <li key={m.skillId} className="flex items-center justify-between gap-2">
                      <span className="truncate text-iw-text-strong">{skill?.name ?? m.skillId}</span>
                      <span className="text-iw-text-muted">{m.level}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            );
          })
        )}
      </div>
    </AppShell>
  );
}

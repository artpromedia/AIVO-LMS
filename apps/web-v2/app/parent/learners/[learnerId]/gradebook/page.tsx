/**
 * Sprint 30: Parent · Gradebook.
 * Detailed per-skill mastery + recent session log. Mirrors the legacy
 * gradebook page, but built on the v2 MasteryMap + LessonRun repos.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getLearner,
  getMasteryMap,
  listLessonRunsForLearner,
  listSkills,
  listSubjects,
  parentCanAccessLearner,
} from "@/lib/db/repos";
import type { SkillMasteryLevel } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const LEVEL_LABEL: Record<SkillMasteryLevel, string> = {
  not_started: "Not started",
  emerging: "Emerging",
  approaching: "Approaching",
  on_grade_level: "On grade level",
  stretching: "Stretching",
};

const LEVEL_TONE: Record<SkillMasteryLevel, "neutral" | "warning" | "success" | "primary"> = {
  not_started: "neutral",
  emerging: "warning",
  approaching: "warning",
  on_grade_level: "success",
  stretching: "primary",
};

export default async function ParentGradebookPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  const t = await getTranslations("parent.learner_gradebook");
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  const { map, skillMasteries } = await getMasteryMap(learnerId, session.tenantId);
  const allLessonRuns = await listLessonRunsForLearner(learnerId, session.tenantId);
  const lessonRuns = allLessonRuns.slice(0, 20);
  const subjects = await listSubjects();
  const skills = await listSkills();
  const skillsById = new Map(skills.map((s) => [s.id, s]));
  const subjectsById = new Map(subjects.map((s) => [s.id, s]));

  // Aggregate to subject averages.
  const subjectAgg = new Map<string, { total: number; count: number }>();
  for (const sm of skillMasteries) {
    const agg = subjectAgg.get(sm.subjectId) ?? { total: 0, count: 0 };
    agg.total += sm.score;
    agg.count += 1;
    subjectAgg.set(sm.subjectId, agg);
  }
  const subjectRows = Array.from(subjectAgg.entries())
    .map(([subjectId, { total, count }]) => ({
      subject: subjectsById.get(subjectId),
      average: count ? total / count : 0,
      skillCount: count,
    }))
    .filter((r) => r.subject)
    .sort((a, b) => b.average - a.average);

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
        description={
          map
            ? `Last evaluated ${new Date(map.updatedAt).toLocaleDateString()}.`
            : "No mastery snapshot yet — gradebook will populate after the baseline assessment."
        }
      />

      {subjectRows.length === 0 ? (
        <EmptyState
          title={t("no_mastery_data")}
          description="Complete the baseline assessment to start tracking skill-by-skill progress."
          action={
            <Link
              href={`/parent/learners/${learner.id}/assessment`}
              className="text-aivo-accent underline underline-offset-4"
            >
              {t("start_baseline")}
            </Link>
          }
        />
      ) : (
        <>
          <SectionHeader title={t("subject_averages")} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjectRows.map((r) => (
              <Card key={r.subject!.id} className="p-[var(--aivo-density-card-pad)]">
                <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
                  {r.subject!.name}
                </p>
                <p className="mt-1 font-display text-2xl font-semibold">
                  {Math.round(r.average * 100)}%
                </p>
                <div className="mt-2 h-2 w-full rounded-full bg-aivo-border">
                  <div
                    className="h-2 rounded-full bg-aivo-accent"
                    style={{ width: `${Math.round(r.average * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-aivo-ink-soft">
                  {r.skillCount} skill{r.skillCount === 1 ? "" : "s"} tracked
                </p>
              </Card>
            ))}
          </div>

          <SectionHeader title={t("skill_mastery")} />
          <Card className="overflow-hidden p-0">
            <div className="max-h-[480px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-aivo-surface-soft text-xs uppercase tracking-wide text-aivo-ink-soft">
                  <tr>
                    <th className="px-4 py-2 text-left">Skill</th>
                    <th className="px-4 py-2 text-left">{t("col_subject")}</th>
                    <th className="px-4 py-2 text-left">Level</th>
                    <th className="px-4 py-2 text-right">Score</th>
                    <th className="px-4 py-2 text-right">{t("col_confidence")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...skillMasteries]
                    .sort((a, b) => b.score - a.score)
                    .map((sm) => {
                      const skill = skillsById.get(sm.skillId);
                      const subject = subjectsById.get(sm.subjectId);
                      return (
                        <tr
                          key={`${sm.learnerId}-${sm.skillId}`}
                          className="border-t border-aivo-border"
                        >
                          <td className="px-4 py-2 font-medium">{skill?.name ?? sm.skillId}</td>
                          <td className="px-4 py-2 text-aivo-ink-soft">{subject?.name ?? "—"}</td>
                          <td className="px-4 py-2">
                            <Badge tone={LEVEL_TONE[sm.level]}>{LEVEL_LABEL[sm.level]}</Badge>
                          </td>
                          <td className="px-4 py-2 text-right font-mono">
                            {Math.round(sm.score * 100)}%
                          </td>
                          <td className="px-4 py-2 text-right font-mono">
                            {Math.round(sm.confidence * 100)}%
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <SectionHeader title={t("recent_sessions")} />
      {lessonRuns.length === 0 ? (
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-sm text-aivo-ink-soft">{t("no_sessions")}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-soft text-xs uppercase tracking-wide text-aivo-ink-soft">
              <tr>
                <th className="px-4 py-2 text-left">{t("col_started")}</th>
                <th className="px-4 py-2 text-left">{t("col_subject")}</th>
                <th className="px-4 py-2 text-left">{t("col_source")}</th>
                <th className="px-4 py-2 text-left">{t("col_status")}</th>
              </tr>
            </thead>
            <tbody>
              {lessonRuns.map((run) => (
                <tr key={run.id} className="border-t border-aivo-border">
                  <td className="px-4 py-2 font-mono text-xs">
                    {new Date(run.startedAt ?? run.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    {subjectsById.get(run.subjectId)?.name ?? run.subjectId}
                  </td>
                  <td className="px-4 py-2 text-aivo-ink-soft">{run.source}</td>
                  <td className="px-4 py-2">
                    <Badge
                      tone={
                        run.status === "completed"
                          ? "success"
                          : run.status === "failed"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {run.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}

/**
 * Sprint 14: Parent · Plain-language summary. A one-pager intended for the
 * fridge: how the learner is doing, what's working, what's next. Built from
 * the most-recent ParentLessonSummary records + the MasteryMap.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getLearner,
  getMasteryMap,
  listParentLessonSummaries,
  listSkills,
  listSubjects,
  parentCanAccessLearner,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function ParentSummaryPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  const t = await getTranslations("parent.learner_summary");
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  const summaries = listParentLessonSummaries(learnerId, session.tenantId, { limit: 5 });
  const { skillMasteries } = await getMasteryMap(learnerId, session.tenantId);
  const subjects = await listSubjects();
  const skills = await listSkills();
  const skillsById = new Map(skills.map((s) => [s.id, s]));

  // Top 3 strongest + 3 needs-work skills (skip empty mastery).
  const sorted = [...skillMasteries].sort((a, b) => b.score - a.score);
  const strongest = sorted.slice(0, 3);
  const needsWork = [...sorted].reverse().slice(0, 3);

  // Subjects we've worked in this week's recent summaries.
  const workedSubjectIds = new Set(summaries.map((s) => s.subjectId));
  const workedSubjects = subjects.filter((s) => workedSubjectIds.has(s.id));

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
            <Button asChild variant="outline">
              <Link href={`/parent/learners/${learnerId}/progress`}>{t("progress_link")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/parent/learners/${learnerId}/lessons`}>{t("lessons_link")}</Link>
            </Button>
          </div>
        }
      />

      <Card className="p-6">
        <p className="font-display text-2xl">
          {summaries.length === 0
            ? `${learner.displayName} hasn't completed any lessons yet — start one to see a recap here.`
            : `In the last ${summaries.length} lesson${summaries.length === 1 ? "" : "s"}, ${learner.displayName} worked in ${workedSubjects.map((s) => s.name).join(", ") || "their subjects"}.`}
        </p>
      </Card>

      <SectionHeader className="mt-8" title={t("whats_going_well")} />
      <Card className="p-[var(--aivo-density-card-pad)]">
        {strongest.length === 0 ? (
          <p className="text-iw-ink-muted">{t("fill_after_lessons")}</p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {strongest.map((m) => (
              <li key={m.skillId} className="flex items-center justify-between gap-2">
                <span>{skillsById.get(m.skillId)?.name ?? m.skillId}</span>
                <span className="text-iw-ink-muted">
                  {Math.round(m.score * 100)}% · {m.level}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SectionHeader className="mt-8" title={t("keep_practicing")} />
      <Card className="p-[var(--aivo-density-card-pad)]">
        {needsWork.length === 0 ? (
          <p className="text-iw-ink-muted">{t("no_skills_flagged")}</p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {needsWork.map((m) => (
              <li key={m.skillId} className="flex items-center justify-between gap-2">
                <span>{skillsById.get(m.skillId)?.name ?? m.skillId}</span>
                <span className="text-iw-ink-muted">
                  {Math.round(m.score * 100)}% · {m.level}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {summaries.length > 0 && (
        <>
          <SectionHeader className="mt-8" title={t("recent_lessons")} />
          <div className="grid gap-3">
            {summaries.map((s) => (
              <Card key={s.id} className="p-[var(--aivo-density-card-pad)]">
                <p className="font-semibold">{s.headline}</p>
                <p className="mt-1 text-sm text-iw-ink-muted">
                  Up next: {s.highlights.recommendedNext}
                </p>
              </Card>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}

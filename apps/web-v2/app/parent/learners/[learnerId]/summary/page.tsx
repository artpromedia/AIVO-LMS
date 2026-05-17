/**
 * Sprint 14: Parent · Plain-language summary. A one-pager intended for the
 * fridge: how the learner is doing, what's working, what's next. Built from
 * the most-recent ParentLessonSummary records + the MasteryMap.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
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
  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    notFound();
  }
  const learner = getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  const summaries = listParentLessonSummaries(learnerId, session.tenantId, { limit: 5 });
  const { skillMasteries } = getMasteryMap(learnerId, session.tenantId);
  const subjects = listSubjects();
  const skills = listSkills();
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
        title="Plain-language summary"
        description="One-page snapshot — what's working and what's next."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/parent/learners/${learnerId}/progress`}>Progress</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/parent/learners/${learnerId}/lessons`}>Lessons</Link>
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

      <SectionHeader className="mt-8" title="What's going well" />
      <Card className="p-[var(--aivo-density-card-pad)]">
        {strongest.length === 0 ? (
          <p className="text-aivo-ink-soft">We'll fill this in after the first few lessons.</p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {strongest.map((m) => (
              <li key={m.skillId} className="flex items-center justify-between gap-2">
                <span>{skillsById.get(m.skillId)?.name ?? m.skillId}</span>
                <span className="text-aivo-ink-soft">
                  {Math.round(m.score * 100)}% · {m.level}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SectionHeader className="mt-8" title="Where we'll keep practicing" />
      <Card className="p-[var(--aivo-density-card-pad)]">
        {needsWork.length === 0 ? (
          <p className="text-aivo-ink-soft">No skills flagged yet.</p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {needsWork.map((m) => (
              <li key={m.skillId} className="flex items-center justify-between gap-2">
                <span>{skillsById.get(m.skillId)?.name ?? m.skillId}</span>
                <span className="text-aivo-ink-soft">
                  {Math.round(m.score * 100)}% · {m.level}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {summaries.length > 0 && (
        <>
          <SectionHeader className="mt-8" title="Recent lessons" />
          <div className="grid gap-3">
            {summaries.map((s) => (
              <Card key={s.id} className="p-[var(--aivo-density-card-pad)]">
                <p className="font-semibold">{s.headline}</p>
                <p className="mt-1 text-sm text-aivo-ink-soft">
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

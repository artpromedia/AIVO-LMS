/**
 * Sprint 14: Parent · Lessons page. Lists recent ParentLessonSummary records
 * — the plain-language per-run digest. Never shows raw AI JSON.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getLearner,
  listParentLessonSummaries,
  listSkills,
  listSubjects,
  parentCanAccessLearner,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function ParentLessonsPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  if (!await parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  const summaries = listParentLessonSummaries(learnerId, session.tenantId, { limit: 50 });
  const subjectsById = new Map(listSubjects().map((s) => [s.id, s]));
  const skillsById = new Map(listSkills().map((s) => [s.id, s]));

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={learner.displayName}
        title="Lessons"
        description="A plain-language recap of every completed lesson."
        actions={
          <Button asChild variant="outline">
            <Link href={`/parent/learners/${learnerId}/progress`}>See progress</Link>
          </Button>
        }
      />
      {summaries.length === 0 ? (
        <Card className="p-6 text-aivo-ink-soft">
          No completed lessons yet. Recaps will appear here as {learner.displayName} finishes
          lessons.
        </Card>
      ) : (
        <div className="grid gap-3">
          {summaries.map((s) => {
            const subject = subjectsById.get(s.subjectId);
            const skill = skillsById.get(s.skillId);
            const delta = s.masteryDelta.after - s.masteryDelta.before;
            return (
              <Card key={s.id} className="p-[var(--aivo-density-card-pad)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase text-aivo-ink-soft">
                      {subject?.name ?? "Learning"} · {skill?.name ?? "Skill"}
                    </p>
                    <p className="font-semibold">{s.headline}</p>
                  </div>
                  <Badge tone={delta > 0 ? "success" : delta < 0 ? "warning" : "neutral"}>
                    {delta > 0 ? "+" : ""}
                    {Math.round(delta * 100)}%
                  </Badge>
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-aivo-ink-soft">Worked on</dt>
                    <dd>{s.highlights.whatWorkedOn}</dd>
                  </div>
                  <div>
                    <dt className="text-aivo-ink-soft">Went well</dt>
                    <dd>{s.highlights.wentWell}</dd>
                  </div>
                  {s.highlights.neededHelp && (
                    <div>
                      <dt className="text-aivo-ink-soft">Needed help</dt>
                      <dd>{s.highlights.neededHelp}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-aivo-ink-soft">Up next</dt>
                    <dd>{s.highlights.recommendedNext}</dd>
                  </div>
                </dl>
                {s.highlights.supportsUsed.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {s.highlights.supportsUsed.map((sup) => (
                      <Badge key={sup} tone="primary">
                        {sup}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-xs text-aivo-ink-soft">
                  {new Date(s.createdAt).toLocaleString()}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

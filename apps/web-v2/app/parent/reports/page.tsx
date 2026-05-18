import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PARENT_NAV } from "@/components/layout/role-shells";
import {
  listLearnersForParent,
  listLessonRunsForLearner,
  listParentLessonSummaries,
  listSubjects,
} from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["parent"]);
  const learners = listLearnersForParent(session.userId, session.tenantId);
  const subjectMap = new Map(listSubjects().map((s) => [s.id, s]));

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Parent"
        title="Reports"
        description="Plain-language summaries of every learner's recent activity."
      />
      {learners.length === 0 ? (
        <EmptyState
          title="No learners yet"
          description="Add a learner to begin generating progress reports."
        />
      ) : (
        learners.map((l) => {
          const summaries = listParentLessonSummaries(l.id, session.tenantId).slice(0, 8);
          const runs = listLessonRunsForLearner(l.id, session.tenantId);
          const completed = runs.filter((r) => r.status === "completed").length;
          return (
            <section key={l.id} className="mb-10">
              <SectionHeader
                title={l.displayName}
                description={`${completed} lesson${completed === 1 ? "" : "s"} completed · ${runs.length} total runs`}
              />
              {summaries.length === 0 ? (
                <Card className="p-[var(--aivo-density-card-pad)] text-sm text-aivo-ink-soft">
                  No completed lessons yet for {l.displayName}.
                </Card>
              ) : (
                <div className="grid gap-3">
                  {summaries.map((s) => (
                    <Card key={s.lessonRunId} className="p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{s.headline}</p>
                        <Badge tone="primary">
                          {subjectMap.get(s.subjectId)?.name ?? "Subject"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-aivo-ink-soft">
                        {s.highlights.recommendedNext}
                      </p>
                      <Link
                        href={`/parent/learners/${l.id}`}
                        className="mt-2 inline-block text-xs font-medium text-aivo-primary hover:underline"
                      >
                        Open learner →
                      </Link>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </AppShell>
  );
}

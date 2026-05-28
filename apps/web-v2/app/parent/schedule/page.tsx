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
  listActiveAssignmentsForLearner,
  listLessonRunsForLearner,
  listSubjects,
} from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["parent"]);
  const learners = await listLearnersForParent(session.userId, session.tenantId);
  const subjectMap = new Map((await listSubjects()).map((s) => [s.id, s]));

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Parent"
        title="Schedule"
        description="What each learner is working on next."
      />
      {learners.length === 0 ? (
        <EmptyState
          title="No learners yet"
          description="Add a learner to see their upcoming work here."
        />
      ) : (
        await Promise.all(
          learners.map(async (l) => {
            const assignments = await listActiveAssignmentsForLearner(l.id, session.tenantId);
            const allActive = await listLessonRunsForLearner(l.id, session.tenantId);
            const activeRuns = allActive.filter(
              (r) => r.status === "ready" || r.status === "in_progress",
            );
          return (
            <section key={l.id} className="mb-10">
              <SectionHeader
                title={l.displayName}
                description={`${assignments.length} teacher assignment${assignments.length === 1 ? "" : "s"} · ${activeRuns.length} active lesson${activeRuns.length === 1 ? "" : "s"}`}
              />
              <div className="grid gap-3">
                {assignments.map((a) => (
                  <Card key={a.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{a.title}</p>
                        <p className="text-sm text-aivo-ink-soft">
                          {subjectMap.get(a.subjectId)?.name ?? "Subject"}
                          {a.dueAt ? ` · due ${new Date(a.dueAt).toLocaleDateString()}` : ""}
                        </p>
                      </div>
                      <Badge tone="primary">Teacher</Badge>
                    </div>
                  </Card>
                ))}
                {activeRuns.map((r) => (
                  <Card key={r.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">In-progress lesson</p>
                        <p className="text-sm text-aivo-ink-soft">Source: {r.source}</p>
                      </div>
                      <Link
                        href={`/learner/lesson-runs/${r.id}`}
                        className="text-xs font-medium text-aivo-primary hover:underline"
                      >
                        Open →
                      </Link>
                    </div>
                  </Card>
                ))}
                {assignments.length === 0 && activeRuns.length === 0 ? (
                  <Card className="p-4 text-sm text-aivo-ink-soft">
                    Nothing scheduled — {l.displayName} will pick from Today's Mission next time
                    they sign in.
                  </Card>
                ) : null}
              </div>
            </section>
          );
          }),
        )
      )}
    </AppShell>
  );
}

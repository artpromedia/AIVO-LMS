import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import {
  listActiveAssignmentsForLearner,
  listLessonRunsForLearner,
  listSubjects,
} from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["learner"]);
  const learnerId = session.learnerId;
  if (!learnerId) {
    return (
      <AppShell
        role="learner"
        roleLabel="Learner"
        navItems={LEARNER_NAV}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <EmptyState title="No learner profile linked" />
      </AppShell>
    );
  }
  const subjectMap = new Map((await listSubjects()).map((s) => [s.id, s]));
  const assignments = listActiveAssignmentsForLearner(learnerId, session.tenantId);
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
        eyebrow="Learner"
        title="Missions"
        description="Your active assignments and lessons in progress."
      />
      <div className="space-y-3">
        {assignments.map((a) => (
          <Card key={a.id} className="p-4">
            <p className="font-medium">{a.title}</p>
            <p className="text-sm text-aivo-ink-soft">
              {subjectMap.get(a.subjectId)?.name ?? "Subject"} · from your teacher
            </p>
          </Card>
        ))}
        {runs.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Lesson in progress</p>
                <p className="text-sm text-aivo-ink-soft">Source: {r.source}</p>
              </div>
              <Link
                href={`/learner/lesson-runs/${r.id}`}
                className="text-xs font-medium text-aivo-primary hover:underline"
              >
                Continue →
              </Link>
            </div>
          </Card>
        ))}
        {assignments.length === 0 && runs.length === 0 ? (
          <EmptyState
            title="Nothing waiting"
            description="Head to Today to pick your next mission."
            action={
              <Link
                href="/learner/home"
                className="text-sm font-medium text-aivo-primary hover:underline"
              >
                Go to Today →
              </Link>
            }
          />
        ) : null}
      </div>
    </AppShell>
  );
}

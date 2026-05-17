import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { listLessonRunsForLearner } from "@/lib/db/repos";

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
  const runs = listLessonRunsForLearner(learnerId, session.tenantId)
    .filter((r) => r.status === "completed")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Learner"
        title="Library"
        description="Replay lessons you've already finished."
      />
      {runs.length === 0 ? (
        <EmptyState
          title="Nothing finished yet"
          description="Complete a lesson from Today's Mission and it will land here."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {runs.map((r) => (
            <Card key={r.id} className="p-4">
              <p className="font-medium">Lesson</p>
              <p className="text-sm text-aivo-ink-soft">
                Source: {r.source}
                {r.completedAt
                  ? ` · completed ${new Date(r.completedAt).toLocaleDateString()}`
                  : ""}
              </p>
              <Link
                href={`/learner/lesson-runs/${r.id}`}
                className="mt-2 inline-block text-xs font-medium text-aivo-primary hover:underline"
              >
                Replay →
              </Link>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

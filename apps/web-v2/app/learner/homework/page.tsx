/**
 * Sprint 17: Homework Helper entry — start a new session or resume a recent one.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { readActiveLearnerFromCookies } from "@/lib/auth/active-learner";
import { AppShell } from "@/components/layout/app-shell";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listHomeworkSessionsForLearner } from "@/lib/db/repos";
import { StartHomeworkForm } from "./start-form";

export const dynamic = "force-dynamic";

export default async function LearnerHomeworkPage() {
  const session = await requirePageRole(["learner", "parent"]);
  let learnerId: string | null = null;
  if (session.role === "learner") {
    learnerId = session.learnerId ?? null;
    if (!learnerId) redirect("/learner/select");
  } else {
    learnerId = await readActiveLearnerFromCookies(session);
    if (!learnerId) redirect("/learner/select");
  }
  const recent = listHomeworkSessionsForLearner(learnerId, session.tenantId, { limit: 10 });

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Homework Helper"
        title="Stuck on something?"
        description="Tell me what you're working on. I'll guide you — I won't just hand you the answer."
      />
      <Card className="p-[var(--aivo-density-card-pad)]">
        <StartHomeworkForm learnerId={learnerId} />
      </Card>
      {recent.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Recent sessions
          </h2>
          <ul className="grid gap-2">
            {recent.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/learner/homework/${s.id}`}
                  className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Card className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{s.topic}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(s.startedAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge tone={s.endedAt ? "neutral" : "primary"}>
                        {s.endedAt ? "Done" : "Open"}
                      </Badge>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}

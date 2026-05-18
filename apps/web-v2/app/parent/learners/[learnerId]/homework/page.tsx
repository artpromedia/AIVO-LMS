/**
 * Sprint 17: Parent-facing homework history. Shows topic + insight + counts
 * only — never raw message contents. The learner experience is private; the
 * parent gets a high-level read on what was worked on.
 */
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { getLearner, listHomeworkSessionsForLearner, parentCanAccessLearner } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function ParentHomeworkHistoryPage({
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
  const sessions = listHomeworkSessionsForLearner(learnerId, session.tenantId);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={learner.displayName}
        title="Homework history"
        description="What your child has been working on with the Homework Helper. Message contents stay between your child and the tutor."
      />
      {sessions.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">No homework sessions yet.</Card>
      ) : (
        <ul className="grid gap-3">
          {sessions.map((s) => (
            <li key={s.id}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{s.topic}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(s.startedAt).toLocaleString()} · {s.messages.length} messages
                    </p>
                    {s.insight && <p className="text-sm mt-2">{s.insight}</p>}
                  </div>
                  <Badge tone={s.endedAt ? "neutral" : "primary"}>
                    {s.endedAt ? "Done" : "Open"}
                  </Badge>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

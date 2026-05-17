/**
 * Sprint 17: Homework chat. Renders message history server-side then hands
 * off to a small client component for the live send/receive loop.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { readActiveLearnerFromCookies } from "@/lib/auth/active-learner";
import { AppShell } from "@/components/layout/app-shell";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getHomeworkSession } from "@/lib/db/repos";
import { HomeworkChat } from "./chat";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ sessionId: string }> };

export default async function HomeworkSessionPage({ params }: Params) {
  const { sessionId } = await params;
  const session = await requirePageRole(["learner", "parent"]);
  let learnerId: string | null = null;
  if (session.role === "learner") {
    learnerId = session.learnerId ?? null;
    if (!learnerId) redirect("/learner/select");
  } else {
    learnerId = await readActiveLearnerFromCookies(session);
    if (!learnerId) redirect("/learner/select");
  }
  const hw = getHomeworkSession(sessionId, session.tenantId);
  if (!hw || hw.learnerId !== learnerId) notFound();

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader eyebrow="Homework Helper" title={hw.topic} />
      {hw.endedAt ? (
        <Card className="p-[var(--aivo-density-card-pad)]">
          <h2 className="font-semibold">Session summary</h2>
          <p className="mt-2 text-sm">{hw.insight}</p>
          <div className="mt-4">
            <Button asChild variant="soft">
              <Link href="/learner/homework">Start a new session</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <HomeworkChat
          learnerId={learnerId}
          sessionId={hw.id}
          initialMessages={hw.messages}
        />
      )}
    </AppShell>
  );
}

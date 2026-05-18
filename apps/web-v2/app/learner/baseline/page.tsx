import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Play } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import {
  createBaseline,
  getActiveBaselineForLearner,
  getBrainProfile,
  getOrCreateParentAssessment,
  listBaselineAttempts,
  listBaselineQuestions,
} from "@/lib/db/repos";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";

async function ensureBaselineAction() {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "learner" || !session.learnerId) redirect("/login");
  const learnerId = session.learnerId;
  const assessment = getOrCreateParentAssessment(learnerId, session.tenantId);
  if (!assessment.submittedAt) redirect("/learner/home");
  if (!getBrainProfile(learnerId, session.tenantId)) redirect("/learner/home");
  let baseline = getActiveBaselineForLearner(learnerId, session.tenantId);
  if (!baseline || baseline.status === "complete") {
    const created = createBaseline({ learnerId, tenantId: session.tenantId });
    if (!created) redirect("/learner/home");
    baseline = created!.baseline;
    audit(session, "baseline.create", newRequestId(), {
      learnerId,
      metadata: { baselineId: baseline.id, questionCount: created!.questions.length },
    });
  }
  redirect(`/learner/baseline/${baseline.id}`);
}

export default async function LearnerBaselineIndex() {
  const session = await requirePageRole(["learner"]);
  const learnerId = session.learnerId;
  if (!learnerId) redirect("/learner/home");

  const assessment = getOrCreateParentAssessment(learnerId, session.tenantId);
  const ready =
    Boolean(assessment.submittedAt) && Boolean(getBrainProfile(learnerId, session.tenantId));
  const baseline = getActiveBaselineForLearner(learnerId, session.tenantId);

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Baseline"
        title="A quick check-in"
        description="A few friendly questions so your tutor knows where to start."
      />

      {!ready ? (
        <EmptyState
          title="A grown-up will set this up"
          description="Ask the grown-up who signed you up to finish the setup."
          action={
            <Button asChild variant="outline">
              <Link href="/learner/home">Back home</Link>
            </Button>
          }
        />
      ) : !baseline || baseline.status === "complete" ? (
        <Card className="flex flex-col gap-3 p-[var(--aivo-density-card-pad)] sm:flex-row sm:items-center">
          <Play className="h-6 w-6 text-aivo-primary" />
          <div className="flex-1">
            <p className="font-display text-lg font-semibold">
              {baseline?.status === "complete" ? "Want to try again?" : "Ready when you are"}
            </p>
            <p className="text-sm text-aivo-ink-soft">Take your time. You can skip any question.</p>
          </div>
          <form action={ensureBaselineAction}>
            <Button type="submit">
              {baseline?.status === "complete" ? "Start again" : "Start"}{" "}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </form>
        </Card>
      ) : (
        (() => {
          const qs = listBaselineQuestions(baseline.id);
          const ats = listBaselineAttempts(baseline.id, session.tenantId);
          return (
            <Card className="flex flex-col gap-3 p-[var(--aivo-density-card-pad)] sm:flex-row sm:items-center">
              <Play className="h-6 w-6 text-aivo-primary" />
              <div className="flex-1">
                <p className="font-display text-lg font-semibold">Pick up where you left off</p>
                <p className="text-sm text-aivo-ink-soft">
                  {ats.length} of {qs.length} answered.
                </p>
              </div>
              <Button asChild>
                <Link href={`/learner/baseline/${baseline.id}`}>
                  Continue <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </Card>
          );
        })()
      )}
    </AppShell>
  );
}

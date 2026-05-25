import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Play, Sparkles } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PARENT_NAV } from "@/components/layout/role-shells";
import {
  createBaseline,
  getActiveBaselineForLearner,
  getBrainProfile,
  getLearner,
  getOrCreateParentAssessment,
  listBaselineAttempts,
  listBaselineQuestions,
  listSubjects,
  parentCanAccessLearner,
  refreshLearnerReadiness,
} from "@/lib/db/repos";
import { BASELINE_TUTORS, tutorForSubjectSlug } from "@/lib/learner/baseline-tutors";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";

async function startBaselineAction(formData: FormData) {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") || "");
  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    redirect("/parent/learners");
  }
  const assessment = getOrCreateParentAssessment(learnerId, session.tenantId);
  if (!assessment.submittedAt) {
    redirect(`/parent/learners/${learnerId}/assessment`);
  }
  if (!getBrainProfile(learnerId, session.tenantId)) {
    redirect(`/parent/learners/${learnerId}/brain-profile`);
  }
  // Reuse an existing in-progress baseline before creating a new one.
  let baseline = getActiveBaselineForLearner(learnerId, session.tenantId);
  if (!baseline || baseline.status === "complete") {
    const created = await createBaseline({ learnerId, tenantId: session.tenantId });
    if (!created) redirect(`/parent/learners/${learnerId}`);
    baseline = created!.baseline;
    audit(session, "baseline.create", newRequestId(), {
      learnerId,
      metadata: { baselineId: baseline.id, questionCount: created!.questions.length },
    });
  }
  refreshLearnerReadiness(learnerId, session.tenantId);
  redirect(`/learner/baseline/${baseline.id}?as=parent`);
}

export default async function ParentBaselinePage({
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

  const assessment = getOrCreateParentAssessment(learnerId, session.tenantId);
  if (!assessment.submittedAt) {
    return (
      <AppShell
        role="parent"
        roleLabel="Parent"
        navItems={PARENT_NAV}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <PageHeader
          eyebrow={`Baseline for ${learner.displayName}`}
          title="Finish the parent assessment first"
          description="The baseline is built from your assessment plus the brain profile."
        />
        <EmptyState
          title="Assessment not yet submitted"
          action={
            <Button asChild>
              <Link href={`/parent/learners/${learner.id}/assessment`}>
                Continue assessment <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  if (!getBrainProfile(learnerId, session.tenantId)) {
    return (
      <AppShell
        role="parent"
        roleLabel="Parent"
        navItems={PARENT_NAV}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <PageHeader
          eyebrow={`Baseline for ${learner.displayName}`}
          title="Review the brain profile first"
          description="We use the brain profile to personalize the questions."
        />
        <EmptyState
          title="Brain profile not generated"
          action={
            <Button asChild>
              <Link href={`/parent/learners/${learner.id}/brain-profile`}>
                Open brain profile <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const baseline = getActiveBaselineForLearner(learnerId, session.tenantId);
  const subjects = listSubjects();
  const subjectsById = new Map(subjects.map((s) => [s.id, s]));

  const questions = baseline ? listBaselineQuestions(baseline.id) : [];
  const attempts = baseline ? listBaselineAttempts(baseline.id, session.tenantId) : [];

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={`Baseline for ${learner.displayName}`}
        title="A Discovery Adventure check-in"
        description="Six short chapters — Reading, Math, Science, Social-Emotional, Speech, and Executive Function — each guided by a friendly tutor. We use the results to start at the right level."
      />

      {!baseline ? (
        <Card className="flex flex-col gap-3 p-[var(--aivo-density-card-pad)] sm:flex-row sm:items-center">
          <Sparkles className="h-6 w-6 text-aivo-primary" />
          <div className="flex-1">
            <p className="font-display text-lg font-semibold">Ready to start</p>
            <p className="text-sm text-aivo-ink-soft">
              We'll generate {`${learner.displayName}'s`} personalized baseline now.
            </p>
          </div>
          <form action={startBaselineAction}>
            <input type="hidden" name="learnerId" value={learner.id} />
            <Button type="submit">
              <Play className="mr-1 h-4 w-4" /> Start baseline
            </Button>
          </form>
        </Card>
      ) : baseline.status !== "complete" ? (
        <Card className="flex flex-col gap-3 p-[var(--aivo-density-card-pad)] sm:flex-row sm:items-center">
          <Play className="h-6 w-6 text-aivo-primary" />
          <div className="flex-1">
            <p className="font-display text-lg font-semibold">Baseline in progress</p>
            <p className="text-sm text-aivo-ink-soft">
              {attempts.length} of {questions.length} answered so far.
            </p>
          </div>
          <Button asChild>
            <Link href={`/learner/baseline/${baseline.id}?as=parent`}>
              Continue baseline <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <form action={startBaselineAction}>
            <input type="hidden" name="learnerId" value={learner.id} />
            <Button type="submit" variant="outline">
              Restart
            </Button>
          </form>
        </Card>
      ) : (
        <>
          <Card className="flex items-start gap-3 p-[var(--aivo-density-card-pad)]">
            <CheckCircle2 className="mt-0.5 h-6 w-6 text-aivo-success" />
            <div>
              <p className="font-display text-lg font-semibold">Baseline complete</p>
              <p className="mt-1 text-sm">{baseline.summary?.parentSummary}</p>
            </div>
          </Card>

          <SectionHeader title="Per chapter" className="mt-6" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {baseline.summary?.perSubject.map((row) => {
              const subj = subjectsById.get(row.subjectId);
              const tutor = subj ? tutorForSubjectSlug(subj.slug) : null;
              return (
                <Card key={row.subjectId} className="p-4">
                  <div className="flex items-center gap-2">
                    {tutor ? (
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-full text-base"
                        style={{
                          backgroundColor: `${tutor.color}1A`,
                          color: tutor.color,
                        }}
                        aria-hidden
                      >
                        {tutor.emoji}
                      </span>
                    ) : null}
                    <p className="text-sm font-semibold">
                      {tutor ? `${tutor.name} · ` : ""}
                      {row.subjectName}
                    </p>
                  </div>
                  <Badge tone="primary" className="mt-2 capitalize">
                    {row.estimate.replaceAll("_", " ")}
                  </Badge>
                  <p className="mt-2 text-xs text-aivo-ink-soft">
                    {row.correct} of {row.answered} correct ({Math.round(row.accuracy * 100)}%)
                  </p>
                </Card>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href={`/parent/learners/${learner.id}`}>
                Back to learner <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <form action={startBaselineAction}>
              <input type="hidden" name="learnerId" value={learner.id} />
              <Button type="submit" variant="outline">
                Restart baseline
              </Button>
            </form>
          </div>
        </>
      )}

      <SectionHeader title="The six chapters" className="mt-8" />
      <p className="-mt-2 mb-3 text-sm text-aivo-ink-soft">
        Each chapter is hosted by a tutor character. They introduce themselves and adapt the
        difficulty as your learner answers.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BASELINE_TUTORS.map((t) => {
          const subj = subjects.find((s) => s.slug === t.subjectSlug);
          const summaryRow = subj
            ? baseline?.summary?.perSubject.find((r) => r.subjectId === subj.id)
            : undefined;
          const covered = subj ? (baseline?.subjectIds ?? []).includes(subj.id) : false;
          return (
            <Card key={t.id} className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
                  style={{ backgroundColor: `${t.color}1A`, color: t.color }}
                  aria-hidden
                >
                  {t.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {t.name}'s {t.landmark}
                  </p>
                  <p className="text-xs text-aivo-ink-soft">{t.subtitle}</p>
                </div>
                {summaryRow ? (
                  <Badge tone="success" className="capitalize">
                    {summaryRow.estimate.replaceAll("_", " ")}
                  </Badge>
                ) : covered ? (
                  <Badge tone="primary">In set</Badge>
                ) : (
                  <Badge tone="neutral">Preview</Badge>
                )}
              </div>
              <p className="mt-2 text-xs text-aivo-ink-soft">{t.scene}</p>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}

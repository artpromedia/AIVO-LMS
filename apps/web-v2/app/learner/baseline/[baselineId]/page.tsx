import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, SkipForward, Volume2 } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LEARNER_NAV, PARENT_NAV } from "@/components/layout/role-shells";
import {
  completeBaseline,
  getBaselineById,
  getLearner,
  listBaselineAttempts,
  listBaselineQuestions,
  listSubjects,
  parentCanAccessLearner,
  recordBaselineAttempt,
  refreshLearnerReadiness,
  startBaseline,
} from "@/lib/db/repos";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";
import { tutorForSubjectSlug } from "@/lib/learner/baseline-tutors";

/**
 * Defense-in-depth: server actions are mutating endpoints reachable from any
 * authenticated session. The BFF guards already check learner scope, but the
 * server-action path bypasses BFF — so we also confirm the baseline actually
 * belongs to the form-supplied learnerId before mutating anything.
 */
function assertBaselineMatchesLearner(
  baselineId: string,
  learnerId: string,
  tenantId: string,
): boolean {
  const b = getBaselineById(baselineId, tenantId);
  return Boolean(b && b.learnerId === learnerId);
}

async function answerAction(formData: FormData) {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session) redirect("/login");
  const baselineId = String(formData.get("baselineId") || "");
  const learnerId = String(formData.get("learnerId") || "");
  const questionId = String(formData.get("questionId") || "");
  const response = String(formData.get("response") || "");
  const skipped = String(formData.get("skipped") || "") === "1";
  const asParent = String(formData.get("asParent") || "") === "1";

  // Scope check based on role.
  if (session.role === "parent") {
    if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
      redirect("/parent/learners");
    }
  } else if (session.role === "learner") {
    if (session.learnerId !== learnerId) redirect("/learner/home");
  } else {
    redirect("/login");
  }

  // Reject mismatched baseline/learner combos before any mutation.
  if (!assertBaselineMatchesLearner(baselineId, learnerId, session.tenantId)) {
    redirect(session.role === "parent" ? "/parent/learners" : "/learner/home");
  }

  startBaseline(baselineId, session.tenantId);
  const attempt = recordBaselineAttempt({
    baselineId,
    questionId,
    learnerId,
    tenantId: session.tenantId,
    response,
    skipped,
  });
  if (attempt) {
    audit(session, "baseline.answer", newRequestId(), {
      learnerId,
      metadata: { baselineId, questionId, skipped, isCorrect: attempt.isCorrect },
    });
  }
  const path = asParent
    ? `/learner/baseline/${baselineId}?as=parent`
    : `/learner/baseline/${baselineId}`;
  redirect(path);
}

async function completeAction(formData: FormData) {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session) redirect("/login");
  const baselineId = String(formData.get("baselineId") || "");
  const learnerId = String(formData.get("learnerId") || "");
  const asParent = String(formData.get("asParent") || "") === "1";

  if (session.role === "parent") {
    if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
      redirect("/parent/learners");
    }
  } else if (session.role === "learner") {
    if (session.learnerId !== learnerId) redirect("/learner/home");
  } else {
    redirect("/login");
  }

  if (!assertBaselineMatchesLearner(baselineId, learnerId, session.tenantId)) {
    redirect(session.role === "parent" ? "/parent/learners" : "/learner/home");
  }

  const result = completeBaseline(baselineId, session.tenantId);
  refreshLearnerReadiness(learnerId, session.tenantId);
  if (result) {
    audit(session, "baseline.complete", newRequestId(), {
      learnerId,
      metadata: {
        baselineId,
        correct: result.summary.correctCount,
        answered: result.summary.totalAnswered,
        brainCloned: Boolean(result.clonedBrainProfile),
        brainCloneStage: result.clonedBrainProfile?.cloneStage ?? null,
      },
    });
  }
  redirect(
    asParent
      ? `/parent/learners/${learnerId}/baseline`
      : `/learner/baseline/${baselineId}`,
  );
}

export default async function BaselineRunnerPage({
  params,
  searchParams,
}: {
  params: Promise<{ baselineId: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const sp = await searchParams;
  const asParent = sp.as === "parent";
  const session = await requirePageRole(asParent ? ["parent"] : ["learner", "parent"]);
  const { baselineId } = await params;

  const baseline = getBaselineById(baselineId, session.tenantId);
  if (!baseline) notFound();

  // Scope check.
  if (session.role === "parent") {
    if (!parentCanAccessLearner(session.userId, baseline.learnerId, session.tenantId)) {
      notFound();
    }
  } else if (session.role === "learner") {
    if (session.learnerId !== baseline.learnerId) notFound();
  }

  const learner = getLearner(baseline.learnerId, session.tenantId);
  const subjects = listSubjects();
  const subjectsById = new Map(subjects.map((s) => [s.id, s]));
  const questions = listBaselineQuestions(baseline.id);
  const attempts = listBaselineAttempts(baseline.id, session.tenantId);
  const answeredQids = new Set(attempts.map((a) => a.questionId));
  const next = questions.find((q) => !answeredQids.has(q.id));
  const totalAnswered = attempts.length;

  const nav = asParent ? PARENT_NAV : LEARNER_NAV;
  const role: "parent" | "learner" = asParent ? "parent" : "learner";
  const roleLabel = asParent ? "Parent" : "Learner";

  if (baseline.status === "complete") {
    return (
      <AppShell
        role={role}
        roleLabel={roleLabel}
        navItems={nav}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <PageHeader
          eyebrow="Baseline"
          title="Nice work!"
          description={baseline.summary?.learnerSafeSummary ?? "You did it."}
        />
        <Card className="flex items-start gap-3 p-[var(--aivo-density-card-pad)]">
          <CheckCircle2 className="mt-0.5 h-6 w-6 text-aivo-success" />
          <div className="text-sm">
            <p className="font-display text-lg font-semibold">All done</p>
            <p className="mt-1">
              You answered {baseline.summary?.totalAnswered ?? 0} of{" "}
              {baseline.summary?.totalQuestions ?? 0} questions.
            </p>
          </div>
        </Card>
        <div className="mt-6">
          <Button asChild>
            <Link
              href={
                asParent
                  ? `/parent/learners/${baseline.learnerId}/baseline`
                  : `/learner/home`
              }
            >
              Continue <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (!next) {
    // All questions answered but not yet completed.
    return (
      <AppShell
        role={role}
        roleLabel={roleLabel}
        navItems={nav}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <PageHeader
          eyebrow="Baseline"
          title="Ready to finish"
          description="Tap the button to send your answers."
        />
        <form action={completeAction}>
          <input type="hidden" name="baselineId" value={baseline.id} />
          <input type="hidden" name="learnerId" value={baseline.learnerId} />
          {asParent ? <input type="hidden" name="asParent" value="1" /> : null}
          <Button type="submit">
            Finish baseline <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </form>
      </AppShell>
    );
  }

  const subject = subjectsById.get(next.subjectId);
  const subjectName = subject?.name ?? "";
  const tutor = subject ? tutorForSubjectSlug(subject.slug) : null;
  const progress = `${Math.min(totalAnswered + 1, questions.length)} of ${questions.length}`;

  return (
    <AppShell
      role={role}
      roleLabel={roleLabel}
      navItems={nav}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={tutor ? `${tutor.name}'s ${tutor.landmark}` : `Baseline · ${subjectName}`}
        title={`Question ${progress}`}
        description={
          learner ? `For ${learner.displayName}.` : "Take your time. You can skip."
        }
        actions={
          <Badge tone="primary" className="capitalize">
            {next.difficulty.replaceAll("_", " ")}
          </Badge>
        }
      />

      {tutor ? (
        <Card
          className="flex items-start gap-3 p-4"
          style={{
            backgroundColor: `${tutor.color}0F`,
            borderColor: `${tutor.color}55`,
          }}
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
            style={{ backgroundColor: `${tutor.color}1A`, color: tutor.color }}
            aria-hidden
          >
            {tutor.emoji}
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">{tutor.name} says:</p>
            <p className="text-aivo-ink-soft">{tutor.greeting}</p>
          </div>
        </Card>
      ) : null}

      <Card className="p-6">
        <p className="font-display text-xl font-semibold">{next.prompt}</p>
        {next.readAloudText ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-aivo-ink-soft">
            <Volume2 className="h-3.5 w-3.5" /> Read aloud available
          </p>
        ) : null}

        <form action={answerAction} className="mt-5 space-y-3">
          <input type="hidden" name="baselineId" value={baseline.id} />
          <input type="hidden" name="learnerId" value={baseline.learnerId} />
          <input type="hidden" name="questionId" value={next.id} />
          {asParent ? <input type="hidden" name="asParent" value="1" /> : null}

          {next.choices && next.choices.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="sr-only">Choose one</legend>
              {next.choices.map((choice, i) => (
                <label
                  key={choice}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-aivo-ink-soft/20 bg-aivo-surface p-3 text-sm hover:border-aivo-primary/50 focus-within:border-aivo-primary"
                >
                  <input
                    type="radio"
                    name="response"
                    value={choice}
                    required
                    defaultChecked={i === 0 ? false : false}
                    className="h-4 w-4"
                  />
                  <span>{choice}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <input
              type="text"
              name="response"
              required
              placeholder="Type your answer"
              className="w-full rounded-lg border border-aivo-ink-soft/20 bg-aivo-surface p-3 text-sm focus:border-aivo-primary focus:outline-none"
            />
          )}

          {next.hint ? (
            <p className="rounded-md bg-aivo-canvas/60 p-3 text-xs text-aivo-ink-soft">
              <strong>Hint:</strong> {next.hint}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit">
              Submit answer <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button
              type="submit"
              variant="outline"
              name="skipped"
              value="1"
              formNoValidate
            >
              <SkipForward className="mr-1 h-4 w-4" /> Skip
            </Button>
          </div>
        </form>
      </Card>

      <SectionHeader title="Progress" className="mt-8" />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {questions.map((q, i) => {
          const a = attempts.find((x) => x.questionId === q.id);
          const tone = a ? (a.skipped ? "neutral" : "success") : "neutral";
          return (
            <Card key={q.id} className="flex items-center gap-3 p-3">
              <span className="font-mono text-xs text-aivo-ink-soft">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 truncate text-xs">{q.prompt}</span>
              <Badge tone={tone}>
                {a ? (a.skipped ? "skipped" : "answered") : "pending"}
              </Badge>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}

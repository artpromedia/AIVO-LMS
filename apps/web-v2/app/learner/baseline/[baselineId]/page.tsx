import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";
import {
  LearnerBaselineShell,
  LearnerQuestionCard,
  LearnerChoiceCard,
  BaselineProgressDots,
  PersonalizationChip,
  HintCard,
  ReadAloudButton,
  BreakCard,
  CompletionHero,
  ProctorBanner,
  type DotState,
  type PersonalizationVariant,
} from "@aivo/ui";
import {
  completeBaseline,
  getBaselineById,
  getIEPForLearner,
  getLearner,
  getOrCreateParentAssessment,
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
import { resolveBaselineImage } from "@/lib/learner/baseline-image";

/**
 * Sprint 6: calm baseline runner.
 *
 * Defense-in-depth: server actions are mutating endpoints reachable
 * from any authenticated session. The BFF guards already check
 * learner scope, but the server-action path bypasses BFF — we also
 * confirm the baseline actually belongs to the form-supplied
 * learnerId before mutating anything.
 *
 * Break cadence: after every BREAK_EVERY answered questions we show
 * a BreakCard before the next question. The learner taps "Resume" to
 * continue — break is just a soft pause, no state is mutated.
 */
const BREAK_EVERY = 5;

async function assertBaselineMatchesLearner(
  baselineId: string,
  learnerId: string,
  tenantId: string,
): Promise<boolean> {
  const b = await getBaselineById(baselineId, tenantId);
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

  if (session.role === "parent") {
    if (!await parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
      redirect("/parent/learners");
    }
  } else if (session.role === "learner") {
    if (session.learnerId !== learnerId) redirect("/learner/home");
  } else {
    redirect("/login");
  }

  if (!(await assertBaselineMatchesLearner(baselineId, learnerId, session.tenantId))) {
    redirect(session.role === "parent" ? "/parent/learners" : "/learner/home");
  }

  await startBaseline(baselineId, session.tenantId);
  const attempt = await recordBaselineAttempt({
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
    if (!await parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
      redirect("/parent/learners");
    }
  } else if (session.role === "learner") {
    if (session.learnerId !== learnerId) redirect("/learner/home");
  } else {
    redirect("/login");
  }

  if (!(await assertBaselineMatchesLearner(baselineId, learnerId, session.tenantId))) {
    redirect(session.role === "parent" ? "/parent/learners" : "/learner/home");
  }

  const result = await completeBaseline(baselineId, session.tenantId);
  await refreshLearnerReadiness(learnerId, session.tenantId);
  if (result) {
    audit(session, "baseline.complete", newRequestId(), {
      learnerId,
      metadata: {
        baselineId,
        correct: result.summary.correctCount,
        answered: result.summary.totalAnswered,
        brainCloned: Boolean(result.clonedBrainProfile),
      },
    });
  }
  // Sprint 14: when the brain clone landed cleanly, route into the
  // awakening / watch sequence (the user-facing "wow" moment) instead of
  // dropping the user back on a summary card. The clone routes themselves
  // re-redirect to the baseline summary if their gates aren't met (e.g.
  // schema validation failure left cloneStage === "pre_clone"), so this
  // is safe even when `result.clonedBrainProfile` is null.
  if (result?.clonedBrainProfile) {
    redirect(
      asParent
        ? `/parent/learners/${learnerId}/brain-clone-watch`
        : `/learner/brain-clone/${learnerId}`,
    );
  }
  redirect(asParent ? `/parent/learners/${learnerId}/baseline` : `/learner/baseline/${baselineId}`);
}

export default async function BaselineRunnerPage({
  params,
  searchParams,
}: {
  params: Promise<{ baselineId: string }>;
  searchParams: Promise<{ as?: string; resume?: string; paused?: string }>;
}) {
  const sp = await searchParams;
  const asParent = sp.as === "parent";
  const session = await requirePageRole(asParent ? ["parent"] : ["learner", "parent"]);
  const { baselineId } = await params;

  const baseline = await getBaselineById(baselineId, session.tenantId);
  if (!baseline) notFound();

  if (session.role === "parent") {
    if (!await parentCanAccessLearner(session.userId, baseline.learnerId, session.tenantId)) {
      notFound();
    }
  } else if (session.role === "learner") {
    if (session.learnerId !== baseline.learnerId) notFound();
  }

  const learner = await getLearner(baseline.learnerId, session.tenantId);
  const subjects = listSubjects();
  const subjectsById = new Map(subjects.map((s) => [s.id, s]));
  const questions = await listBaselineQuestions(baseline.id);
  const attempts = await listBaselineAttempts(baseline.id, session.tenantId);
  const answeredQids = new Set(attempts.map((a) => a.questionId));
  const totalAnswered = attempts.length;
  const next = questions.find((q) => !answeredQids.has(q.id));

  const iep = getIEPForLearner(baseline.learnerId, session.tenantId);
  const assessment = await getOrCreateParentAssessment(baseline.learnerId, session.tenantId);
  const sensorySensitivities =
    (assessment.answers.sensory as { sensitivities?: string[] })?.sensitivities ?? [];
  const calmMode = sensorySensitivities.length > 0;

  const chips: PersonalizationVariant[] = ["parent_assessment", "no_grades"];
  if (iep?.confirmedAt) chips.unshift("iep");
  if (learner?.accessibilityDefaults.audioFirst || iep?.extraction?.readingSupport) {
    chips.push("read_aloud");
  }
  if (calmMode) chips.push("calm_mode");
  if (iep?.extraction?.extendedTime) chips.push("extended_time");

  const topBanner = asParent ? (
    <ProctorBanner
      role="parent"
      proctorName={session.displayName}
      learnerName={learner?.displayName ?? "your learner"}
      exit={
        <Link
          href={`/parent/learners/${baseline.learnerId}/baseline`}
          className="inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
        >
          Exit proctor view
        </Link>
      }
    />
  ) : undefined;

  /* --------- Completion screen --------- */
  if (baseline.status === "complete") {
    const subjectMastery = baseline.summary?.perSubject ?? [];
    return (
      <LearnerBaselineShell
        topBanner={topBanner}
        headerLeft={
          <Link
            href={asParent ? `/parent/learners/${baseline.learnerId}/baseline` : "/learner/home"}
            className="inline-flex items-center gap-1.5 rounded-iw-control px-3 py-1.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-sunken)]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            {asParent ? "Back to baseline" : "Back home"}
          </Link>
        }
      >
        <CompletionHero
          learnerName={learner?.preferredName || learner?.firstName}
          answered={baseline.summary?.totalAnswered ?? 0}
          total={baseline.summary?.totalQuestions ?? 0}
          showAnswered={asParent}
          body={baseline.summary?.learnerSafeSummary ?? undefined}
          learned={[
            ...subjectMastery.map((s) => `${s.subjectName}: starting at ${s.estimate.replaceAll("_", " ")}`),
            ...(chips.includes("iep") ? ["IEP supports stay on"] : []),
            ...(chips.includes("calm_mode") ? ["Calm pacing locked in"] : []),
          ]}
          primary={
            <Link
              href={asParent ? `/parent/learners/${baseline.learnerId}/baseline/summary` : "/learner/home"}
              className="inline-flex items-center gap-2 rounded-iw-control px-5 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110 shadow-[0_4px_12px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.3)]"
            >
              {asParent ? "See the parent summary" : "Take me home"}
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m13 5 7 7-7 7" />
              </svg>
            </Link>
          }
        />
      </LearnerBaselineShell>
    );
  }

  /* --------- Ready-to-submit screen (every question answered) --------- */
  if (!next) {
    return (
      <LearnerBaselineShell topBanner={topBanner}>
        <CompletionHero
          learnerName={learner?.preferredName || learner?.firstName}
          title="One last tap"
          body="You answered every question. Send your answers when you're ready."
          primary={
            <form action={completeAction}>
              <input type="hidden" name="baselineId" value={baseline.id} />
              <input type="hidden" name="learnerId" value={baseline.learnerId} />
              {asParent ? <input type="hidden" name="asParent" value="1" /> : null}
              <Button type="submit" size="lg">
                Finish baseline
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14" />
                  <path d="m13 5 7 7-7 7" />
                </svg>
              </Button>
            </form>
          }
        />
      </LearnerBaselineShell>
    );
  }

  /* --------- Break screen (between question blocks) --------- */
  // Show a break every BREAK_EVERY answered questions, but only if the
  // learner hasn't already passed it (sp.resume=1 skips the break).
  const dueForBreak =
    totalAnswered > 0 && totalAnswered % BREAK_EVERY === 0 && sp.resume !== "1";
  if (dueForBreak) {
    return (
      <LearnerBaselineShell
        topBanner={topBanner}
        status={[
          <PersonalizationChip key="paused" variant="paused" />,
          ...chips.slice(0, 3).map((v) => <PersonalizationChip key={v} variant={v} />),
        ]}
      >
        <BreakCard
          learnerName={learner?.preferredName || learner?.firstName}
          answered={totalAnswered}
          total={questions.length}
          resume={
            <Link
              href={`/learner/baseline/${baseline.id}?resume=1${asParent ? "&as=parent" : ""}`}
              className="inline-flex items-center gap-2 rounded-iw-control px-5 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
            >
              Resume
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </Link>
          }
          secondary={
            <Link
              href={asParent ? `/parent/learners/${baseline.learnerId}/baseline` : "/learner/home"}
              className="inline-flex items-center gap-1.5 rounded-iw-control px-4 py-2.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-sunken)]"
            >
              Stop for today
            </Link>
          }
        />
      </LearnerBaselineShell>
    );
  }

  /* --------- Question screen --------- */
  const subject = subjectsById.get(next.subjectId);
  const tutor = subject ? tutorForSubjectSlug(subject.slug) : null;

  // Per-question dot states for the progress strip.
  const dots: DotState[] = questions.map((q, i) => {
    const a = attempts.find((x) => x.questionId === q.id);
    if (a) return a.skipped ? "skipped" : "answered";
    if (q.id === next.id) return "current";
    return i < totalAnswered ? "pending" : "pending";
  });

  // Sprint A — surface picture-prompt anchors above the prompt so
  // picture-referencing questions ("…the picture of a cat") actually
  // show the cat. `resolveBaselineImage` upgrades a `sceneEmoji` (or a
  // keyword-matched fallback from the prompt text) into a Twemoji SVG
  // so the learner sees a real cartoon picture instead of a tiny font
  // glyph. Falls back to the bare emoji span when no URL resolves.
  let promptHeader: ReactNode = null;
  const resolvedImage = resolveBaselineImage({
    imageUrl: next.imageUrl,
    imageAlt: next.imageAlt,
    sceneEmoji: next.sceneEmoji,
    prompt: next.prompt,
  });
  if (resolvedImage.imageUrl) {
    promptHeader = (
      <img
        src={resolvedImage.imageUrl}
        alt={resolvedImage.imageAlt ?? ""}
        className="block h-32 w-32 md:h-40 md:w-40 mb-3 object-contain select-none"
        draggable={false}
      />
    );
  } else if (next.sceneEmoji) {
    promptHeader = (
      <span
        className="block text-6xl md:text-7xl mb-3 select-none"
        role="img"
        aria-label={next.imageAlt ?? "Prompt picture"}
      >
        {next.sceneEmoji}
      </span>
    );
  }

  return (
    <LearnerBaselineShell
      topBanner={topBanner}
      headerLeft={
        <p className="text-xs text-iw-text-muted">
          {subject?.name ?? "Question"} · {Math.min(totalAnswered + 1, questions.length)} of{" "}
          {questions.length}
        </p>
      }
      headerRight={
        <Link
          href={asParent ? `/parent/learners/${baseline.learnerId}/baseline` : "/learner/home"}
          className="inline-flex items-center gap-1.5 rounded-iw-control px-3 py-1.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-sunken)]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
          Pause
        </Link>
      }
      status={chips.slice(0, 4).map((v) => (
        <PersonalizationChip key={v} variant={v} />
      ))}
    >
      <BaselineProgressDots states={dots} ariaLabel="Baseline progress" />

      <LearnerQuestionCard
        eyebrow={tutor ? `With ${tutor.name} · ${tutor.landmark}` : subject?.name}
        companion={
          tutor ? (
            <span
              className="w-12 h-12 rounded-full inline-flex items-center justify-center text-2xl"
              style={{ backgroundColor: `${tutor.color}1A`, color: tutor.color }}
              aria-hidden="true"
            >
              {tutor.emoji}
            </span>
          ) : null
        }
        prompt={
          <>
            {promptHeader}
            <span>{next.prompt}</span>
          </>
        }
        readAloud={
          next.readAloudText ? <ReadAloudButton href={`?read=${next.id}`} /> : null
        }
        footer={
          <>
            <div className="flex items-center gap-2">
              <form action={answerAction}>
                <input type="hidden" name="baselineId" value={baseline.id} />
                <input type="hidden" name="learnerId" value={baseline.learnerId} />
                <input type="hidden" name="questionId" value={next.id} />
                <input type="hidden" name="skipped" value="1" />
                {asParent ? <input type="hidden" name="asParent" value="1" /> : null}
                <Button type="submit" variant="outline" size="sm" formNoValidate>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="5 4 15 12 5 20 5 4" />
                    <line x1="19" y1="5" x2="19" y2="19" />
                  </svg>
                  Skip
                </Button>
              </form>
            </div>
            <Button type="submit" form={`answer-form-${next.id}`}>
              Next
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m13 5 7 7-7 7" />
              </svg>
            </Button>
          </>
        }
      >
        <form id={`answer-form-${next.id}`} action={answerAction} className="flex flex-col gap-3">
          <input type="hidden" name="baselineId" value={baseline.id} />
          <input type="hidden" name="learnerId" value={baseline.learnerId} />
          <input type="hidden" name="questionId" value={next.id} />
          {asParent ? <input type="hidden" name="asParent" value="1" /> : null}

          {next.choices && next.choices.length > 0 ? (
            <fieldset className="flex flex-col gap-3">
              <legend className="sr-only">Choose one</legend>
              {next.choices.map((choice, i) => {
                const emoji = next.choiceEmojis?.[i];
                // Upgrade the bare emoji to a Twemoji SVG so each
                // option looks like a real cartoon picture (dog, cat,
                // car). Falls back to the raw emoji glyph if the
                // codepoint isn't in Twemoji's pack.
                const choiceImg = emoji
                  ? resolveBaselineImage({ sceneEmoji: emoji })
                  : undefined;
                let lead: ReactNode = undefined;
                if (choiceImg?.imageUrl) {
                  lead = (
                    <img
                      src={choiceImg.imageUrl}
                      alt=""
                      className="h-10 w-10 object-contain select-none"
                      draggable={false}
                    />
                  );
                } else if (emoji) {
                  lead = (
                    <span className="text-3xl leading-none" aria-hidden="true">
                      {emoji}
                    </span>
                  );
                }
                return (
                  <LearnerChoiceCard
                    key={choice}
                    name="response"
                    value={choice}
                    label={choice}
                    index={i}
                    lead={lead}
                    required
                  />
                );
              })}
            </fieldset>
          ) : (
            <label className="flex flex-col gap-1.5">
              <span className="sr-only">Type your answer</span>
              <input
                type="text"
                name="response"
                required
                placeholder="Type your answer"
                className="w-full rounded-iw-control border border-iw-border bg-white px-4 py-3 text-base text-iw-text-strong placeholder:text-iw-text-muted/70 focus:outline-none focus:border-[var(--aivo-sensory-primary)] focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)]/40"
              />
            </label>
          )}

          {next.hint ? <HintCard hint={next.hint} policy="available" /> : null}
        </form>
      </LearnerQuestionCard>
    </LearnerBaselineShell>
  );
}

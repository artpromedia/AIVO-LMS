import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
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
  getAccessibilityPrefs,
  getBaselineById,
  getBaselineCalibrationMap,
  setBaselineAdaptiveSessionId,
  getIEPForLearner,
  getLearner,
  getLearnerVoicePreference,
  getOrCreateParentAssessment,
  listBaselineAttempts,
  listBaselineQuestions,
  listSubjects,
  parentCanAccessLearner,
  recordBaselineAttempt,
  refreshLearnerReadiness,
  startBaseline,
} from "@/lib/db/repos";
import { learnerPrefStyleVars } from "@/lib/a11y/learner-prefs";
import { resolveBaselineScanConfig } from "@/lib/a11y/baseline-scan";
import { BaselineScanProvider } from "./baseline-scan-provider";
import { buildBaselineAnswerRedirect } from "./answer-redirect";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";
import { tutorForSubjectSlug } from "@/lib/learner/baseline-tutors";
import { TutorFace } from "@/components/learner/art/tutor-character";
import { resolveBaselineImage } from "@/lib/learner/baseline-image";
import { baselineAdaptiveEnabled, baselineStreamingEnabled } from "@/lib/feature-flags";
import {
  selectNextAdaptiveQuestion,
  priorThetaForLearner,
  learnerHasReadingDifficulty,
  assessFrustration,
  STREAK_HIGH,
} from "@/lib/learner/baseline-adaptive";
import { streamNextQuestion, makeHttpStreamClient } from "@/lib/learner/baseline-session";
import { mintAssessmentSvcToken } from "@/lib/learner/assessment-svc-auth";
import { serverEnv } from "@/lib/env";
import { BASELINE_BREAK_EVERY } from "@aivo/adaptive-baseline";
import { LatencyTimer } from "./latency-timer";
import { BaselineListenAudio } from "./listen-audio";
import type { BaselineQuestion } from "@/lib/db/types";

/**
 * Sprint 6: calm baseline runner.
 *
 * Defense-in-depth: server actions are mutating endpoints reachable
 * from any authenticated session. The BFF guards already check
 * learner scope, but the server-action path bypasses BFF — we also
 * confirm the baseline actually belongs to the form-supplied
 * learnerId before mutating anything.
 *
 * Break cadence: after every BASELINE_BREAK_EVERY answered questions we
 * show a BreakCard before the next question. The learner taps "Resume" to
 * continue — break is just a soft pause, no state is mutated. The cadence
 * constant is shared with the mobile runner via @aivo/adaptive-baseline so
 * the two clients pace the baseline identically.
 */

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
  const { getSession } = await import("@/lib/auth/session");
  const session = await getSession();
  if (!session) redirect("/login");
  const baselineId = String(formData.get("baselineId") || "");
  const learnerId = String(formData.get("learnerId") || "");
  const questionId = String(formData.get("questionId") || "");
  const response = String(formData.get("response") || "");
  const skipped = String(formData.get("skipped") || "") === "1";
  const latencyRaw = Number.parseInt(String(formData.get("latencyMs") || ""), 10);
  const latencyMs = Number.isFinite(latencyRaw) && latencyRaw >= 0 ? latencyRaw : undefined;

  if (session.role === "parent") {
    if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
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
    latencyMs,
  });
  if (attempt) {
    audit(session, "baseline.answer", newRequestId(), {
      learnerId,
      metadata: { baselineId, questionId, skipped, isCorrect: attempt.isCorrect },
    });
  }
  redirect(buildBaselineAnswerRedirect(baselineId, formData));
}

async function completeAction(formData: FormData) {
  "use server";
  const { getSession } = await import("@/lib/auth/session");
  const session = await getSession();
  if (!session) redirect("/login");
  const baselineId = String(formData.get("baselineId") || "");
  const learnerId = String(formData.get("learnerId") || "");
  const asParent = String(formData.get("asParent") || "") === "1";

  if (session.role === "parent") {
    if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
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
  searchParams: Promise<{
    as?: string;
    resume?: string;
    paused?: string;
    listen?: string;
  }>;
}) {
  const sp = await searchParams;
  const asParent = sp.as === "parent";
  // Audio-first modality switch offered at a struggle break (never shame):
  // the learner can resume "listening" instead of pushing through.
  const listenMode = sp.listen === "1";
  const session = await requirePageRole(asParent ? ["parent"] : ["learner", "parent"]);
  const { baselineId } = await params;
  const t = await getTranslations("learner.baseline_runner");

  const baseline = await getBaselineById(baselineId, session.tenantId);
  if (!baseline) notFound();

  if (session.role === "parent") {
    if (!(await parentCanAccessLearner(session.userId, baseline.learnerId, session.tenantId))) {
      notFound();
    }
  } else if (session.role === "learner") {
    if (session.learnerId !== baseline.learnerId) notFound();
  }

  const learner = await getLearner(baseline.learnerId, session.tenantId);
  // The learner's persisted reading preferences (dyslexia-friendly font,
  // larger text, looser spacing) → `--learner-*` CSS vars stamped on the
  // baseline shell so they apply INSIDE the question card, not just on chrome.
  const a11yPrefs = await getAccessibilityPrefs(baseline.learnerId, session.tenantId);
  const shellStyle = learnerPrefStyleVars(a11yPrefs);
  // The learner's saved read-aloud voice/speed (set by the parent). The non-scan
  // listen control tunes the browser SpeechSynthesis voice + rate to match these
  // so playback respects the learner's preference instead of the browser default.
  const voicePref = await getLearnerVoicePreference(baseline.learnerId);
  // Sprint C-15 — switch/AAC scanning. Resolve the learner's persisted AAC
  // prefs into a scan config; the runner wraps its interactive region in the
  // aac-bridge scan provider (single-source SwitchScanController) when the
  // learner has explicitly enabled a switch input method. Read-aloud pairs
  // with scan focus only for audio-first learners (off by default).
  const scanConfig = resolveBaselineScanConfig(a11yPrefs);
  const speakOnScanFocus = scanConfig.active && a11yPrefs.audioFirst === true;
  const tScan = await getTranslations("learner.baseline_runner.scan");
  const subjects = await listSubjects();
  const subjectsById = new Map(subjects.map((s) => [s.id, s]));
  const questions = await listBaselineQuestions(baseline.id);
  const attempts = await listBaselineAttempts(baseline.id, session.tenantId);
  const answeredQids = new Set(attempts.map((a) => a.questionId));
  const totalAnswered = attempts.length;

  // Phase 0 — adaptive next-question selection. When the flag is on, the
  // engine picks the next item from the pool based on the learner's running
  // accuracy (item N+1 difficulty depends on item N), seeded by a cold-start
  // prior from comfort signals, and can stop early. When off, fall back to
  // the original static order (first unanswered question).
  let next: BaselineQuestion | undefined;
  if (baselineAdaptiveEnabled()) {
    const calibration = await getBaselineCalibrationMap({ tenantId: session.tenantId });

    // Prefer the server-authoritative streaming session when enabled and a
    // service token is configured. Any failure falls through to the local
    // adaptive path below, so streaming can never dead-end the runner.
    let streamed = false;
    // Prefer a short-lived learner-scoped JWT (so assessment-svc checkAccess
    // passes); fall back to the configured service token.
    const streamToken =
      (await mintAssessmentSvcToken({ userId: session.userId, role: session.role })) ??
      serverEnv.ASSESSMENT_SVC_SERVICE_TOKEN;
    if (baselineStreamingEnabled() && streamToken) {
      const outcome = await streamNextQuestion({
        learnerId: baseline.learnerId,
        baseline,
        questions,
        attempts,
        learner,
        calibration,
        // Wave C (G1): items carry the subject SLUG so the service finalizer
        // splits per-subject θ with canonicalisable keys.
        subjectSlugById: new Map(subjects.map((s) => [s.id, s.slug])),
        client: makeHttpStreamClient(streamToken, serverEnv.ASSESSMENT_SVC_URL),
        persistSessionId: (sessionId) =>
          setBaselineAdaptiveSessionId(baseline.id, session.tenantId, sessionId),
      });
      if (outcome.mode === "streaming") {
        next = outcome.next ?? undefined;
        streamed = true;
      }
    }

    if (!streamed) {
      const selection = selectNextAdaptiveQuestion({
        questions,
        attempts,
        priorTheta: priorThetaForLearner(learner),
        readingDifficulty: learnerHasReadingDifficulty(learner),
        // Live recalibration feedback: serve items at their observed
        // difficulty once they clear the exposure floor (empty map = seed θ).
        calibration,
      });
      next = selection.next ?? undefined;
    }
  } else {
    next = questions.find((q) => !answeredQids.has(q.id));
  }

  const iep = await getIEPForLearner(baseline.learnerId, session.tenantId);
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
          {t("exit_proctor_view")}
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
        style={shellStyle}
        headerLeft={
          <Link
            href={asParent ? `/parent/learners/${baseline.learnerId}/baseline` : "/learner/home"}
            className="inline-flex items-center gap-1.5 rounded-iw-control px-3 py-1.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-sunken)]"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
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
            ...subjectMastery.map(
              (s) => `${s.subjectName}: starting at ${s.estimate.replaceAll("_", " ")}`,
            ),
            ...(chips.includes("iep") ? ["IEP supports stay on"] : []),
            ...(chips.includes("calm_mode") ? ["Calm pacing locked in"] : []),
          ]}
          primary={
            <Link
              href={
                asParent
                  ? `/parent/learners/${baseline.learnerId}/baseline/summary`
                  : "/learner/home"
              }
              className="inline-flex items-center gap-2 rounded-iw-control px-5 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110 shadow-[0_4px_12px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.3)]"
            >
              {asParent ? "See the parent summary" : "Take me home"}
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
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
      <LearnerBaselineShell topBanner={topBanner} style={shellStyle}>
        <BaselineScanProvider
          config={scanConfig}
          speakOnFocus={speakOnScanFocus}
          scanHelpText={scanConfig.stepScan ? tScan("help_two_switch") : tScan("help_one_switch")}
          announceTemplate={(label) => tScan("announce", { label })}
        >
          <CompletionHero
            learnerName={learner?.preferredName || learner?.firstName}
            title={t("ready_title")}
            body={t("ready_body")}
            primary={
              <form action={completeAction}>
                <input type="hidden" name="baselineId" value={baseline.id} />
                <input type="hidden" name="learnerId" value={baseline.learnerId} />
                {asParent ? <input type="hidden" name="asParent" value="1" /> : null}
                <Button
                  type="submit"
                  size="lg"
                  data-scan-target={scanConfig.active ? "finish-baseline" : undefined}
                  data-scan-label={scanConfig.active ? t("finish_baseline") : undefined}
                >
                  {t("finish_baseline")}
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="m13 5 7 7-7 7" />
                  </svg>
                </Button>
              </form>
            }
          />
        </BaselineScanProvider>
      </LearnerBaselineShell>
    );
  }

  /* --------- Break screen (between question blocks) --------- */
  // Show a break every BASELINE_BREAK_EVERY answered questions, but only if
  // the learner hasn't already passed it (sp.resume=1 skips the break).
  // Kindness tightening (G5): also offer a break the moment a struggle
  // run reaches the high threshold — fired once (== STREAK_HIGH) so a
  // hard patch doesn't break on every question.
  const frustration = assessFrustration(attempts);
  const frustrationBreak = frustration.struggleStreak === STREAK_HIGH;
  const dueForBreak =
    totalAnswered > 0 &&
    sp.resume !== "1" &&
    (totalAnswered % BASELINE_BREAK_EVERY === 0 || frustrationBreak);
  if (dueForBreak) {
    // When a struggle run triggered the break, use the gentle struggle copy so
    // the pause explains itself. A plain cadence break keeps the existing
    // wording. The struggle copy is shame-free and never names a wrong count.
    const struggleVariant = frustrationBreak;
    return (
      <LearnerBaselineShell
        topBanner={topBanner}
        style={shellStyle}
        status={[
          <PersonalizationChip key="paused" variant="paused" />,
          ...chips.slice(0, 3).map((v) => <PersonalizationChip key={v} variant={v} />),
        ]}
      >
        <BaselineScanProvider
          config={scanConfig}
          speakOnFocus={speakOnScanFocus}
          scanHelpText={scanConfig.stepScan ? tScan("help_two_switch") : tScan("help_one_switch")}
          announceTemplate={(label) => tScan("announce", { label })}
        >
          <BreakCard
            variant={struggleVariant ? "struggle" : "cadence"}
            title={struggleVariant ? t("struggle_break_title") : undefined}
            body={struggleVariant ? t("struggle_break_body") : undefined}
            learnerName={learner?.preferredName || learner?.firstName}
            answered={totalAnswered}
            total={questions.length}
            resume={
              <Link
                href={`/learner/baseline/${baseline.id}?resume=1${asParent ? "&as=parent" : ""}`}
                className="inline-flex items-center gap-2 rounded-iw-control px-5 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
                data-scan-target={scanConfig.active ? "break-resume" : undefined}
                data-scan-label={scanConfig.active ? t("resume") : undefined}
              >
                {t("resume")}
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </Link>
            }
            secondary={
              <>
                {struggleVariant ? (
                  <Link
                    href={`/learner/baseline/${baseline.id}?resume=1&listen=1${asParent ? "&as=parent" : ""}`}
                    className="inline-flex items-center gap-2 rounded-iw-control px-4 py-2.5 text-sm font-semibold text-[var(--aivo-color-aivoPurple-700)] bg-[var(--aivo-color-aivoPurple-50)] border border-[var(--aivo-color-aivoPurple-100)] hover:brightness-105"
                    data-scan-target={scanConfig.active ? "break-listen" : undefined}
                    data-scan-label={scanConfig.active ? t("listen_instead") : undefined}
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </svg>
                    {t("listen_instead")}
                  </Link>
                ) : null}
                <Link
                  href={
                    asParent ? `/parent/learners/${baseline.learnerId}/baseline` : "/learner/home"
                  }
                  className="inline-flex items-center gap-1.5 rounded-iw-control px-4 py-2.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-sunken)]"
                  data-scan-target={scanConfig.active ? "break-stop" : undefined}
                  data-scan-label={scanConfig.active ? t("stop_for_today") : undefined}
                >
                  {t("stop_for_today")}
                </Link>
              </>
            }
          />
        </BaselineScanProvider>
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
      style={shellStyle}
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
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
          {t("stop_for_today")}
        </Link>
      }
      status={chips.slice(0, 4).map((v) => (
        <PersonalizationChip key={v} variant={v} />
      ))}
    >
      <BaselineScanProvider
        config={scanConfig}
        speakOnFocus={speakOnScanFocus}
        scanHelpText={scanConfig.stepScan ? tScan("help_two_switch") : tScan("help_one_switch")}
        announceTemplate={(label) => tScan("announce", { label })}
      >
        <BaselineProgressDots states={dots} ariaLabel="Baseline progress" />

        <LearnerQuestionCard
          eyebrow={tutor ? `With ${tutor.name} · ${tutor.landmark}` : subject?.name}
          companion={
            tutor ? (
              <span
                className="w-12 h-12 rounded-full inline-flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: `${tutor.color}1A` }}
                aria-hidden="true"
              >
                <TutorFace tutorKey={tutor.tutorKey} size={36} />
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
            next.readAloudText ? (
              <div className="flex flex-col gap-1.5">
                {scanConfig.active ? (
                  // Scan/AAC path: the scan controller speaks `data-scan-read`
                  // on activation, so this stays a link-backed scan target.
                  <ReadAloudButton
                    href={`?read=${next.id}${listenMode ? "&listen=1" : ""}${asParent ? "&as=parent" : ""}`}
                    className={
                      listenMode
                        ? "ring-2 ring-[var(--aivo-sensory-ringFocus)] ring-offset-2 ring-offset-white"
                        : undefined
                    }
                    scanTargetId={`q-${next.id}-readaloud`}
                    scanLabel={tScan("target_read_aloud")}
                    scanReadText={`${next.prompt}. ${next.readAloudText}`}
                  />
                ) : (
                  // Non-scan path: a real read-aloud control backed by the
                  // server TTS pipeline (falls back to the browser voice).
                  // Taps speak the prompt, and in listening mode it
                  // auto-starts on load. Keyed by question id so each new
                  // question re-fires.
                  <BaselineListenAudio
                    key={next.id}
                    learnerId={baseline.learnerId}
                    text={`${next.prompt}. ${next.readAloudText}`}
                    contextRefId={next.id}
                    autoStart={listenMode}
                    speed={voicePref?.speed}
                    voiceId={voicePref?.voiceId}
                    className={
                      listenMode
                        ? "ring-2 ring-[var(--aivo-sensory-ringFocus)] ring-offset-2 ring-offset-white"
                        : undefined
                    }
                  />
                )}
                {listenMode ? (
                  <p className="text-xs text-[var(--aivo-color-aivoPurple-700)]">
                    {t("listen_mode_hint")}
                  </p>
                ) : null}
              </div>
            ) : null
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
                  {listenMode ? <input type="hidden" name="listen" value="1" /> : null}
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    formNoValidate
                    data-scan-target={scanConfig.active ? `q-${next.id}-skip` : undefined}
                    data-scan-label={scanConfig.active ? tScan("target_skip") : undefined}
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polygon points="5 4 15 12 5 20 5 4" />
                      <line x1="19" y1="5" x2="19" y2="19" />
                    </svg>
                    Skip
                  </Button>
                </form>
              </div>
              <Button
                type="submit"
                form={`answer-form-${next.id}`}
                data-scan-target={scanConfig.active ? `q-${next.id}-next` : undefined}
                data-scan-label={scanConfig.active ? tScan("target_next") : undefined}
              >
                Next
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
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
            {listenMode ? <input type="hidden" name="listen" value="1" /> : null}
            {/* Stamps time-on-item into `latencyMs` at submit. Keyed by
              question id so the timer resets for each new item. */}
            <LatencyTimer key={next.id} />

            {next.choices && next.choices.length > 0 ? (
              <fieldset className="flex flex-col gap-3">
                <legend className="sr-only">{t("choose_one")}</legend>
                {next.choices.map((choice, i) => {
                  const emoji = next.choiceEmojis?.[i];
                  // Upgrade the bare emoji to a Twemoji SVG so each
                  // option looks like a real cartoon picture (dog, cat,
                  // car). Falls back to the raw emoji glyph if the
                  // codepoint isn't in Twemoji's pack.
                  const choiceImg = emoji ? resolveBaselineImage({ sceneEmoji: emoji }) : undefined;
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
                      scanTargetId={scanConfig.active ? `q-${next.id}-choice-${i}` : undefined}
                      scanLabel={choice}
                    />
                  );
                })}
              </fieldset>
            ) : (
              <label className="flex flex-col gap-1.5">
                <span className="sr-only">{t("type_answer")}</span>
                <input
                  type="text"
                  name="response"
                  required
                  placeholder={t("type_answer")}
                  // Free-text answers honor the learner's reading prefs too, via
                  // the same `--learner-*` contract vars the shell stamps.
                  style={{
                    fontFamily: "var(--learner-font-family, inherit)",
                    fontSize: "calc(1rem * var(--learner-font-scale, 1))",
                    letterSpacing: "var(--learner-letter-spacing, normal)",
                  }}
                  className="w-full rounded-iw-control border border-iw-border bg-white px-4 py-3 text-iw-text-strong placeholder:text-iw-text-muted/70 focus:outline-none focus:border-[var(--aivo-sensory-primary)] focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)]/40"
                />
              </label>
            )}

            {next.hint ? (
              <HintCard
                hint={next.hint}
                policy="available"
                scanTargetId={scanConfig.active ? `q-${next.id}-hint` : undefined}
                scanLabel={tScan("target_hint")}
              />
            ) : null}
          </form>
        </LearnerQuestionCard>
      </BaselineScanProvider>
    </LearnerBaselineShell>
  );
}

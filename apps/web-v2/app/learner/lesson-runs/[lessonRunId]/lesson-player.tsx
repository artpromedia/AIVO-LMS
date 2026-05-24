"use client";

/**
 * Sprint 13: client-side beat-by-beat lesson player.
 *
 * Beats:
 *   welcome → goal → story → micro → example → guided[] → checks[] → celebrate
 *   → progress → next-step
 *
 * - One beat at a time. Large buttons. Enter/Space advance.
 * - Hint and Break buttons. Hint usage is tracked in the outcome.
 * - Resume: current beat index is mirrored to ?step= so refresh keeps place.
 * - Each beat view fires `POST /step` so we have a server-side audit trail.
 * - On the final beat, "I'm done" calls `POST /complete` with the aggregate
 *   outcome (checksCorrect/Total, hintsUsed, scaffoldsUsed, secondsActive).
 * - Honors accessibility prefs (reducedMotion, largeText, dyslexia font,
 *   highContrast) via wrapper classes + animation gating.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/layout/page-header";
import { AudioControlBar, FocusMode } from "@/components/playful-calm";
import { MathText } from "@/components/learning/math-text";
import type {
  AccessibilityPreferences,
  GeneratedLessonPlan,
  LessonRunStatus,
  LessonStepKind,
} from "@/lib/db/types";
import { recordSurfaceTelemetry } from "@/components/learning/surface-telemetry-buffer";

type Beat =
  | { kind: "welcome"; key: string; body: string }
  | { kind: "goal"; key: string; body: string }
  | { kind: "story"; key: string; body: string }
  | { kind: "micro"; key: string; body: string }
  | { kind: "example"; key: string; prompt: string; explanation: string }
  | {
      kind: "guided";
      key: string;
      gpId: string;
      prompt: string;
      expectedAnswer?: string;
      choices?: string[];
      hint: string;
      scaffold: string;
    }
  | {
      kind: "check";
      key: string;
      checkId: string;
      prompt: string;
      expectedAnswer?: string;
      choices?: string[];
      supportIfWrong: string;
    }
  | { kind: "celebrate"; key: string; body: string }
  | { kind: "progress"; key: string; body: string }
  | { kind: "next"; key: string; body: string };

function buildBeats(plan: GeneratedLessonPlan, shorter: boolean): Beat[] {
  const beats: Beat[] = [
    { kind: "welcome", key: "welcome", body: plan.tutorGreeting },
    { kind: "goal", key: "goal", body: plan.objective },
    { kind: "story", key: "story", body: plan.storyHook },
    { kind: "micro", key: "micro", body: plan.microLesson },
    {
      kind: "example",
      key: "example",
      prompt: plan.example.prompt,
      explanation: plan.example.explanation,
    },
  ];
  // shorterSteps preference: drop the story-hook beat to slim the lesson.
  const trimmed = shorter ? beats.filter((b) => b.kind !== "story") : beats;
  plan.guidedPractice.forEach((g, i) =>
    trimmed.push({
      kind: "guided",
      key: `gp-${i}`,
      gpId: g.id,
      prompt: g.prompt,
      expectedAnswer: g.expectedAnswer,
      choices: g.choices,
      hint: g.hint,
      scaffold: g.scaffold,
    }),
  );
  plan.checksForUnderstanding.forEach((c, i) =>
    trimmed.push({
      kind: "check",
      key: `chk-${i}`,
      checkId: c.id,
      prompt: c.prompt,
      expectedAnswer: c.expectedAnswer,
      choices: c.choices,
      supportIfWrong: c.supportIfWrong,
    }),
  );
  trimmed.push({ kind: "celebrate", key: "celebrate", body: plan.encouragement });
  trimmed.push({ kind: "progress", key: "progress", body: plan.parentSummary });
  trimmed.push({ kind: "next", key: "next", body: plan.nextRecommendedStep });
  return trimmed;
}

function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isCorrect(expected: string | undefined, actual: string): boolean {
  if (!expected) return true; // open-ended response — accept any non-empty answer
  return normalizeAnswer(expected) === normalizeAnswer(actual);
}

type Props = {
  learnerId: string;
  lessonRunId: string;
  plan: GeneratedLessonPlan;
  accessibility: AccessibilityPreferences;
  initialStatus: LessonRunStatus;
  /**
   * Sprint 1.2 — when `true`, the player routes through
   * `/api/bff/learning/sessions/*` (real `learning-svc`) instead of the
   * v1 `/api/bff/learners/.../lesson-runs/*` legacy BFF. Driven by the
   * `LEARNER_LESSON_PLAYER_V2` flag on the server component.
   */
  v2Enabled?: boolean;
  /**
   * v2-only: the `learning-svc` session id created when the lesson run
   * was started. The page server-component creates the session and
   * threads it through so the player can post step/complete events.
   */
  sessionId?: string | null;
  /**
   * v2-only: subject slug the lesson is anchored to. Used to call
   * `/path/advance` once the learner completes. Optional because some
   * legacy runs predate the subject pin.
   */
  subjectSlug?: string | null;
};

export function LessonPlayer({
  learnerId,
  lessonRunId,
  plan,
  accessibility,
  initialStatus,
  v2Enabled = false,
  sessionId = null,
  subjectSlug = null,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const beats = useMemo(
    () => buildBeats(plan, accessibility.shorterSteps),
    [plan, accessibility.shorterSteps],
  );
  const startStep = (() => {
    const raw = Number(searchParams.get("step") ?? 0);
    if (!Number.isFinite(raw) || raw < 0) return 0;
    return Math.min(raw, beats.length - 1);
  })();
  const [stepIdx, setStepIdx] = useState(startStep);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<null | "correct" | "incorrect">(null);
  const [showHint, setShowHint] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  // The four counters and the start timestamp below are kept only for
  // their re-render side-effect (and to mirror the legacy on-device state
  // shape). The server now derives checks/hints/scaffolds/seconds from
  // LessonInteraction rows; see complete() below. Prefixed with `_` to
  // signal intentional unused-read.
  const [_hintsUsed, setHintsUsed] = useState(0);
  const [_scaffoldsUsed, setScaffoldsUsed] = useState(0);
  const [_checksTotal, setChecksTotal] = useState(0);
  const [_checksCorrect, setChecksCorrect] = useState(0);
  const [completing, startTransition] = useTransition();
  const [completeError, setCompleteError] = useState<string | null>(null);
  const _startTimeRef = useRef<number>(Date.now());
  const seenBeats = useRef<Set<string>>(new Set());
  const beat = beats[stepIdx];
  const isLastBeat = stepIdx === beats.length - 1;
  const isInteractive = beat.kind === "guided" || beat.kind === "check";

  // Mark lesson_started once on mount when status === "ready".
  // Deps are intentionally empty: this is a mount-only side-effect.
  useEffect(() => {
    if (initialStatus === "ready") {
      fetch(`/api/bff/learners/${learnerId}/lesson-runs/${lessonRunId}/start`, {
        method: "POST",
      }).catch(() => {});
    }
    // Sprint 1.3: a single impression event for the lesson run.
    recordSurfaceTelemetry({
      learnerId,
      sessionId: sessionId ?? lessonRunId,
      eventType: "impression",
      payload: { lessonRunId, v2: v2Enabled, beatCount: beats.length },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist current step in URL + emit lesson_step_viewed once per beat.
  useEffect(() => {
    if (onBreak) return;
    const url = new URL(window.location.href);
    url.searchParams.set("step", String(stepIdx));
    window.history.replaceState({}, "", url.toString());
    if (!seenBeats.current.has(beat.key)) {
      seenBeats.current.add(beat.key);
      const stepKind: LessonStepKind =
        beat.kind === "welcome"
          ? "intro"
          : beat.kind === "goal"
            ? "intro"
            : beat.kind === "story"
              ? "intro"
              : beat.kind === "micro"
                ? "micro_lesson"
                : beat.kind === "example"
                  ? "example"
                  : beat.kind === "guided"
                    ? "guided_practice"
                    : beat.kind === "check"
                      ? "check_for_understanding"
                      : beat.kind === "celebrate"
                        ? "celebrate"
                        : beat.kind === "progress"
                          ? "progress_update"
                          : "next_step";
      const stepRefId =
        beat.kind === "guided" ? beat.gpId : beat.kind === "check" ? beat.checkId : null;
      sendStep({ stepKind, stepRefId });
      recordSurfaceTelemetry({
        learnerId,
        sessionId: sessionId ?? lessonRunId,
        eventType: "impression",
        payload: { stepKind, stepRefId, beatKey: beat.key, stepIdx },
      });
    }
  }, [stepIdx, beat, learnerId, lessonRunId, onBreak, sessionId]);

  function sendStep(payload: {
    stepKind: string;
    stepRefId?: string | null;
    response?: string;
    isCorrect?: boolean;
  }): void {
    const v1Url = `/api/bff/learners/${learnerId}/lesson-runs/${lessonRunId}/step`;
    const v2Url = sessionId ? `/api/bff/learning/sessions/${sessionId}/advance` : null;
    const url = v2Enabled && v2Url ? v2Url : v1Url;
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  function advance() {
    if (stepIdx < beats.length - 1) {
      setStepIdx(stepIdx + 1);
      setAnswer("");
      setFeedback(null);
      setShowHint(false);
    }
  }

  function submitAnswer() {
    if (!isInteractive || answer.trim().length === 0) return;
    const expected = beat.kind === "guided" ? beat.expectedAnswer : beat.expectedAnswer;
    const correct = isCorrect(expected, answer);
    setFeedback(correct ? "correct" : "incorrect");
    if (beat.kind === "check") {
      setChecksTotal((n) => n + 1);
      if (correct) setChecksCorrect((n) => n + 1);
    }
    const stepRefId =
      beat.kind === "guided" ? beat.gpId : beat.kind === "check" ? beat.checkId : null;
    sendStep({ stepKind: "answer_submitted", stepRefId, response: answer, isCorrect: correct });
    recordSurfaceTelemetry({
      learnerId,
      sessionId: sessionId ?? lessonRunId,
      eventType: "interaction",
      payload: { kind: "answer_submitted", isCorrect: correct, stepRefId, beatKey: beat.key },
    });
  }

  function requestHint() {
    if (beat.kind !== "guided") return;
    setShowHint(true);
    setHintsUsed((n) => n + 1);
    sendStep({ stepKind: "hint_used", stepRefId: beat.gpId });
    recordSurfaceTelemetry({
      learnerId,
      sessionId: sessionId ?? lessonRunId,
      eventType: "interaction",
      payload: { kind: "hint_used", stepRefId: beat.gpId, beatKey: beat.key },
    });
  }

  function useScaffold() {
    if (beat.kind !== "guided") return;
    setScaffoldsUsed((n) => n + 1);
    setAnswer(beat.expectedAnswer ?? "");
    sendStep({ stepKind: "scaffold_used", stepRefId: beat.gpId });
    recordSurfaceTelemetry({
      learnerId,
      sessionId: sessionId ?? lessonRunId,
      eventType: "interaction",
      payload: { kind: "scaffold_used", stepRefId: beat.gpId, beatKey: beat.key },
    });
  }

  function complete(abandoned: boolean) {
    // The BFF now derives checks/hints/scaffolds/seconds from server-recorded
    // LessonInteraction rows (post-architect-review hardening). The client
    // only contributes `abandoned`, which is a UX signal not represented in
    // interactions.
    startTransition(async () => {
      const v1Url = `/api/bff/learners/${learnerId}/lesson-runs/${lessonRunId}/complete`;
      const v2Url =
        v2Enabled && sessionId ? `/api/bff/learning/sessions/${sessionId}/complete` : null;
      // We always hit v1 to keep the lesson_run row consistent (badges,
      // streaks, parent dashboards still read from it). When v2 is on we
      // additionally call /learning/sessions/.../complete so the upstream
      // gradebook + path/advance respond with real mastery.
      const v1Res = await fetch(v1Url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome: { abandoned } }),
      });
      if (!v1Res.ok) {
        // Surface the failure instead of redirecting blindly — otherwise the
        // run would silently stay in_progress and mastery would never update.
        setCompleteError("We couldn't save this lesson. Please try the 'I'm done' button again.");
        return;
      }
      if (v2Url) {
        try {
          await fetch(v2Url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ abandoned }),
          });
          if (subjectSlug) {
            await fetch(
              `/api/bff/learning/path/${learnerId}/${encodeURIComponent(subjectSlug)}/advance`,
              { method: "POST" },
            );
          }
        } catch {
          // v2 completion is best-effort relative to v1.
        }
      }
      recordSurfaceTelemetry({
        learnerId,
        sessionId: sessionId ?? lessonRunId,
        eventType: "completion",
        payload: { lessonRunId, abandoned, stepsViewed: seenBeats.current.size },
      });
      router.push("/learner/home");
      router.refresh();
    });
  }

  // ----- Accessibility-derived classes -----
  const rootClass = [
    accessibility.largeText ? "text-lg leading-relaxed" : "",
    accessibility.dyslexiaFriendlyFont ? "font-mono tracking-wide" : "",
    accessibility.highContrast ? "bg-aivo-surface text-black" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const transitionClass = accessibility.reducedMotion ? "" : "transition-all";

  if (onBreak) {
    return (
      <Card className={`p-8 text-center ${rootClass}`}>
        <PageHeader
          eyebrow="Break"
          title="Take a breath."
          description="When you're ready, come back to keep going."
        />
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => setOnBreak(false)}>I'm ready to keep going</Button>
          <Button variant="soft" onClick={() => complete(true)} disabled={completing}>
            End for now
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className={rootClass}>
      <PageHeader
        eyebrow={plan.tutorPersona}
        title={plan.title}
        description={plan.objective}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="neutral">≈ {plan.estimatedMinutes} min</Badge>
            <Button variant="ghost" onClick={() => setOnBreak(true)}>
              Take a break
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <AudioControlBar />
      </div>
      <div className="mb-4">
        <Progress value={((stepIdx + 1) / beats.length) * 100} />
        <p className="mt-1 text-xs text-aivo-ink-soft" aria-live="polite">
          Step {stepIdx + 1} of {beats.length}
        </p>
      </div>

      <FocusMode title={beat.kind === "check" ? "Knowledge check" : "Lesson focus"}>
      <Card className={`p-6 ${transitionClass}`}>
        {/* Each beat sets aria-live so read-aloud announces it. */}
        <div aria-live="polite" className="space-y-4">
          {beat.kind === "welcome" ||
          beat.kind === "goal" ||
          beat.kind === "story" ||
          beat.kind === "micro" ||
          beat.kind === "celebrate" ||
          beat.kind === "progress" ||
          beat.kind === "next" ? (
            <p className="font-display text-2xl">
              <MathText>{beat.body}</MathText>
            </p>
          ) : null}

          {beat.kind === "example" && (
            <>
              <p className="font-display text-2xl">
                <MathText>{beat.prompt}</MathText>
              </p>
              <p className="text-aivo-ink-soft">
                <MathText>{beat.explanation}</MathText>
              </p>
            </>
          )}

          {beat.kind === "guided" && (
            <>
              <p className="font-display text-2xl">
                <MathText>{beat.prompt}</MathText>
              </p>
              {beat.choices ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {beat.choices.map((c) => (
                    <Button
                      key={c}
                      variant={answer === c ? "default" : "soft"}
                      onClick={() => setAnswer(c)}
                    >
                      <MathText>{c}</MathText>
                    </Button>
                  ))}
                </div>
              ) : (
                <input
                  className="w-full rounded-md border border-aivo-border p-3"
                  placeholder="Type your answer…"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitAnswer();
                  }}
                  aria-label="Your answer"
                />
              )}
              {showHint && (
                <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                  Hint: <MathText>{beat.hint}</MathText>
                </p>
              )}
              {feedback === "correct" && (
                <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">Nice work!</p>
              )}
              {feedback === "incorrect" && (
                <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-900">
                  Not quite — try again or use the hint. <MathText>{beat.scaffold}</MathText>
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={submitAnswer} disabled={!answer.trim()}>
                  Check
                </Button>
                <Button variant="soft" onClick={requestHint} disabled={showHint}>
                  Hint
                </Button>
                <Button variant="ghost" onClick={useScaffold}>
                  Show me how
                </Button>
              </div>
            </>
          )}

          {beat.kind === "check" && (
            <>
              <p className="font-display text-2xl">
                <MathText>{beat.prompt}</MathText>
              </p>
              {beat.choices ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {beat.choices.map((c) => (
                    <Button
                      key={c}
                      variant={answer === c ? "default" : "soft"}
                      onClick={() => setAnswer(c)}
                    >
                      <MathText>{c}</MathText>
                    </Button>
                  ))}
                </div>
              ) : (
                <input
                  className="w-full rounded-md border border-aivo-border p-3"
                  placeholder="Type your answer…"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitAnswer();
                  }}
                  aria-label="Your answer"
                />
              )}
              {feedback === "correct" && (
                <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
                  Yes! You've got this.
                </p>
              )}
              {feedback === "incorrect" && (
                <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-900">
                  Close — <MathText>{beat.supportIfWrong}</MathText>
                </p>
              )}
              <div className="flex gap-2">
                <Button onClick={submitAnswer} disabled={!answer.trim() || feedback !== null}>
                  Check
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex justify-between gap-2">
          <Button
            variant="soft"
            onClick={() => setStepIdx(Math.max(0, stepIdx - 1))}
            disabled={stepIdx === 0}
          >
            Back
          </Button>
          {!isLastBeat ? (
            <Button onClick={advance} disabled={isInteractive && feedback === null}>
              Next
            </Button>
          ) : (
            <Button onClick={() => complete(false)} disabled={completing}>
              {completing ? "Saving…" : "I'm done"}
            </Button>
          )}
        </div>
        {completeError ? (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {completeError}
          </p>
        ) : null}
      </Card>
      </FocusMode>
    </div>
  );
}

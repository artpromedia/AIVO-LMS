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
import type {
  AccessibilityPreferences,
  GeneratedLessonPlan,
  LessonRunStatus,
  LessonStepKind,
} from "@/lib/db/types";

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
  return s.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
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
};

export function LessonPlayer({
  learnerId,
  lessonRunId,
  plan,
  accessibility,
  initialStatus,
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
  const [hintsUsed, setHintsUsed] = useState(0);
  const [scaffoldsUsed, setScaffoldsUsed] = useState(0);
  const [checksTotal, setChecksTotal] = useState(0);
  const [checksCorrect, setChecksCorrect] = useState(0);
  const [completing, startTransition] = useTransition();
  const [completeError, setCompleteError] = useState<string | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const seenBeats = useRef<Set<string>>(new Set());
  const beat = beats[stepIdx];
  const isLastBeat = stepIdx === beats.length - 1;
  const isInteractive = beat.kind === "guided" || beat.kind === "check";

  // Mark lesson_started once on mount when status === "ready".
  useEffect(() => {
    if (initialStatus === "ready") {
      fetch(`/api/bff/learners/${learnerId}/lesson-runs/${lessonRunId}/start`, {
        method: "POST",
      }).catch(() => {});
    }
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
      fetch(`/api/bff/learners/${learnerId}/lesson-runs/${lessonRunId}/step`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stepKind,
          stepRefId:
            beat.kind === "guided"
              ? beat.gpId
              : beat.kind === "check"
                ? beat.checkId
                : null,
        }),
      }).catch(() => {});
    }
  }, [stepIdx, beat, learnerId, lessonRunId, onBreak]);

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
    const expected =
      beat.kind === "guided" ? beat.expectedAnswer : beat.expectedAnswer;
    const correct = isCorrect(expected, answer);
    setFeedback(correct ? "correct" : "incorrect");
    if (beat.kind === "check") {
      setChecksTotal((n) => n + 1);
      if (correct) setChecksCorrect((n) => n + 1);
    }
    fetch(`/api/bff/learners/${learnerId}/lesson-runs/${lessonRunId}/step`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stepKind: "answer_submitted",
        stepRefId:
          beat.kind === "guided"
            ? beat.gpId
            : beat.kind === "check"
              ? beat.checkId
              : null,
        response: answer,
        isCorrect: correct,
      }),
    }).catch(() => {});
  }

  function requestHint() {
    if (beat.kind !== "guided") return;
    setShowHint(true);
    setHintsUsed((n) => n + 1);
    fetch(`/api/bff/learners/${learnerId}/lesson-runs/${lessonRunId}/step`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stepKind: "hint_used",
        stepRefId: beat.gpId,
      }),
    }).catch(() => {});
  }

  function useScaffold() {
    if (beat.kind !== "guided") return;
    setScaffoldsUsed((n) => n + 1);
    setAnswer(beat.expectedAnswer ?? "");
    fetch(`/api/bff/learners/${learnerId}/lesson-runs/${lessonRunId}/step`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stepKind: "scaffold_used",
        stepRefId: beat.gpId,
      }),
    }).catch(() => {});
  }

  function complete(abandoned: boolean) {
    // The BFF now derives checks/hints/scaffolds/seconds from server-recorded
    // LessonInteraction rows (post-architect-review hardening). The client
    // only contributes `abandoned`, which is a UX signal not represented in
    // interactions.
    startTransition(async () => {
      const res = await fetch(
        `/api/bff/learners/${learnerId}/lesson-runs/${lessonRunId}/complete`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ outcome: { abandoned } }),
        },
      );
      if (!res.ok) {
        // Surface the failure instead of redirecting blindly — otherwise the
        // run would silently stay in_progress and mastery would never update.
        setCompleteError(
          "We couldn't save this lesson. Please try the 'I'm done' button again.",
        );
        return;
      }
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
        <Progress value={((stepIdx + 1) / beats.length) * 100} />
        <p className="mt-1 text-xs text-aivo-ink-soft" aria-live="polite">
          Step {stepIdx + 1} of {beats.length}
        </p>
      </div>

      <Card className={`p-6 ${transitionClass}`}>
        {/* Each beat sets aria-live so read-aloud announces it. */}
        <div aria-live="polite" className="space-y-4">
          {beat.kind === "welcome" || beat.kind === "goal" ||
          beat.kind === "story" || beat.kind === "micro" ||
          beat.kind === "celebrate" || beat.kind === "progress" ||
          beat.kind === "next" ? (
            <p className="font-display text-2xl">{beat.body}</p>
          ) : null}

          {beat.kind === "example" && (
            <>
              <p className="font-display text-2xl">{beat.prompt}</p>
              <p className="text-aivo-ink-soft">{beat.explanation}</p>
            </>
          )}

          {beat.kind === "guided" && (
            <>
              <p className="font-display text-2xl">{beat.prompt}</p>
              {beat.choices ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {beat.choices.map((c) => (
                    <Button
                      key={c}
                      variant={answer === c ? "default" : "soft"}
                      onClick={() => setAnswer(c)}
                    >
                      {c}
                    </Button>
                  ))}
                </div>
              ) : (
                <input
                  className="w-full rounded-md border border-aivo-line p-3"
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
                  Hint: {beat.hint}
                </p>
              )}
              {feedback === "correct" && (
                <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
                  Nice work!
                </p>
              )}
              {feedback === "incorrect" && (
                <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-900">
                  Not quite — try again or use the hint. {beat.scaffold}
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
              <p className="font-display text-2xl">{beat.prompt}</p>
              {beat.choices ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {beat.choices.map((c) => (
                    <Button
                      key={c}
                      variant={answer === c ? "default" : "soft"}
                      onClick={() => setAnswer(c)}
                    >
                      {c}
                    </Button>
                  ))}
                </div>
              ) : (
                <input
                  className="w-full rounded-md border border-aivo-line p-3"
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
                  Close — {beat.supportIfWrong}
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
    </div>
  );
}

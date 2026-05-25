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
import { useEffect, useMemo, useRef, useState, useTransition, type SyntheticEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/layout/page-header";
import { AudioControlBar, FocusMode } from "@/components/playful-calm";
import { MathText } from "@/components/learning/math-text";
import {
  SurfaceRouter,
  type SurfaceRouterItem,
  type SurfaceRouterSubmitResult,
  type SurfaceTelemetryEvent,
} from "@aivo/learner-surfaces";
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
      surfaceType: SurfaceRouterItem["surfaceType"];
      prompt: string;
      expectedAnswer?: string;
      choices?: string[];
      hint: string;
      scaffold: string;
      media?: {
        surfaceType: "video" | "audio";
        assets: Array<{
          id: string;
          kind: "video" | "audio" | "captions";
          src: string;
          alt?: string;
          mimeType?: string;
          language?: string;
          label?: string;
          default?: boolean;
        }>;
      };
    }
  | {
      kind: "check";
      key: string;
      checkId: string;
      surfaceType: SurfaceRouterItem["surfaceType"];
      prompt: string;
      expectedAnswer?: string;
      choices?: string[];
      supportIfWrong: string;
      media?: {
        surfaceType: "video" | "audio";
        assets: Array<{
          id: string;
          kind: "video" | "audio" | "captions";
          src: string;
          alt?: string;
          mimeType?: string;
          language?: string;
          label?: string;
          default?: boolean;
        }>;
      };
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
      surfaceType:
        ((g as { surfaceType?: SurfaceRouterItem["surfaceType"] }).surfaceType ??
          (g.choices?.length ? "choice_grid" : "math_expression")),
      prompt: g.prompt,
      expectedAnswer: g.expectedAnswer,
      choices: g.choices,
      hint: g.hint,
      scaffold: g.scaffold,
      media: g.media,
    }),
  );
  plan.checksForUnderstanding.forEach((c, i) =>
    trimmed.push({
      kind: "check",
      key: `chk-${i}`,
      checkId: c.id,
      surfaceType:
        ((c as { surfaceType?: SurfaceRouterItem["surfaceType"] }).surfaceType ??
          (c.choices?.length ? "choice_grid" : "math_expression")),
      prompt: c.prompt,
      expectedAnswer: c.expectedAnswer,
      choices: c.choices,
      supportIfWrong: c.supportIfWrong,
      media: c.media,
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
  v2Enabled?: boolean;
  sessionId?: string;
  subjectSlug?: string | null;
};

type LessonMediaProps = {
  media: NonNullable<
    Extract<Beat, { kind: "guided" | "check" }>["media"]
  >;
  onTelemetry: (event: string) => void;
};

function toVttDataUri(vtt: string): string {
  return `data:text/vtt;charset=utf-8,${encodeURIComponent(vtt)}`;
}

function LessonMedia({ media, onTelemetry }: LessonMediaProps) {
  const mediaAsset = media.assets.find((asset) => asset.kind === media.surfaceType);
  const captions = media.assets.find((asset) => asset.kind === "captions");
  if (!mediaAsset || !captions) return null;
  const source =
    captions.src.startsWith("WEBVTT") || captions.src.includes("\n")
      ? toVttDataUri(captions.src)
      : captions.src.endsWith(".vtt")
        ? captions.src
        : toVttDataUri(captions.src);

  const props = {
    controls: true,
    className: "w-full rounded-md border border-aivo-border",
    onPlay: () => onTelemetry("play"),
    onPause: () => onTelemetry("pause"),
    onSeeked: () => onTelemetry("seek"),
    onEnded: () => onTelemetry("complete"),
    onLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement | HTMLAudioElement>) => {
      const track = event.currentTarget.textTracks?.[0];
      if (track && track.mode !== "showing") {
        track.mode = "showing";
        onTelemetry("caption-on");
      }
    },
  };

  if (media.surfaceType === "video") {
    return (
      <video {...props} data-testid="lesson-media-video">
        <source src={mediaAsset.src} />
        <track
          kind="captions"
          srcLang={captions.language ?? "en"}
          label={captions.label ?? "English"}
          src={source}
          default
        />
      </video>
    );
  }

  return (
    <audio {...props} data-testid="lesson-media-audio">
      <source src={mediaAsset.src} />
      <track
        kind="captions"
        srcLang={captions.language ?? "en"}
        label={captions.label ?? "English"}
        src={source}
        default
      />
    </audio>
  );
}

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
            beat.kind === "guided" ? beat.gpId : beat.kind === "check" ? beat.checkId : null,
        }),
      }).catch(() => {});
    }
  }, [stepIdx, beat, learnerId, lessonRunId, onBreak]);

  function emitMediaTelemetry(surfaceType: "video" | "audio", event: string) {
    fetch(`/api/bff/learners/${learnerId}/lesson-runs/${lessonRunId}/step`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stepKind: "answer_submitted",
        stepRefId: beat.kind === "guided" ? beat.gpId : beat.kind === "check" ? beat.checkId : null,
        response: `media:${surfaceType}:${event}`,
        isCorrect: null,
      }),
    }).catch(() => {});
  }

  function advance() {
    if (stepIdx < beats.length - 1) {
      setStepIdx(stepIdx + 1);
      setFeedback(null);
      setShowHint(false);
    }
  }

  function emitSurfaceTelemetry(event: SurfaceTelemetryEvent) {
    fetch("/api/learning/surface-telemetry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        learnerId,
        sessionId: lessonRunId,
        eventType: event.type,
        payload: event.payload ?? {},
      }),
    }).catch(() => {});
  }

  function toSurfaceItem(currentBeat: Extract<Beat, { kind: "guided" | "check" }>): SurfaceRouterItem {
    return {
      id: currentBeat.kind === "guided" ? currentBeat.gpId : currentBeat.checkId,
      surfaceType: currentBeat.surfaceType,
      prompt: currentBeat.prompt,
      choices: currentBeat.choices,
      expectedAnswer: currentBeat.expectedAnswer,
      instructions:
        currentBeat.kind === "guided"
          ? "Solve the practice and submit your answer."
          : "Complete the check and submit your answer.",
      answerInput: { type: "text", label: "Your answer", placeholder: "Type your answer…" },
      scratchpad:
        currentBeat.surfaceType === "scratchpad" || currentBeat.surfaceType === "ink_canvas"
          ? { enabled: true, width: 520, height: 300 }
          : undefined,
      diagram:
        currentBeat.surfaceType === "geometry_workspace" || currentBeat.surfaceType === "geometry"
          ? {
              canvasMode: "svg",
              width: 480,
              height: 320,
              shapes: [{ id: "fixture-rect", kind: "rectangle", x: 110, y: 70, width: 220, height: 150 }],
            }
          : undefined,
      numberLine:
        currentBeat.surfaceType === "number_line"
          ? {
              min: 0,
              max: 10,
              step: 1,
            }
          : undefined,
      codingSandbox:
        currentBeat.surfaceType === "coding_sandbox"
          ? { language: "javascript", starterCode: "// write your solution\n" }
          : undefined,
      artCanvas: currentBeat.surfaceType === "art_canvas" ? { showGuides: true } : undefined,
      voiceResponse:
        currentBeat.surfaceType === "voice_response" ? { language: "en-US" } : undefined,
    };
  }

  function submitSurface(result: SurfaceRouterSubmitResult) {
    if (!isInteractive) return;
    const interactiveBeat = beat.kind === "guided" || beat.kind === "check" ? beat : null;
    if (!interactiveBeat) return;
    const expected = interactiveBeat.expectedAnswer;
    const candidate =
      typeof result.response.answer === "string"
        ? result.response.answer
        : result.response.selectedChoiceId ?? "";
    const correct =
      result.isCorrect === null ? isCorrect(expected, candidate) : result.isCorrect;

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
          interactiveBeat.kind === "guided"
            ? interactiveBeat.gpId
            : interactiveBeat.kind === "check"
              ? interactiveBeat.checkId
              : null,
        response: candidate,
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
        setCompleteError("We couldn't save this lesson. Please try the 'I'm done' button again.");
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
              {beat.media ? (
                <LessonMedia
                  media={beat.media}
                  onTelemetry={(event) => emitMediaTelemetry(beat.media!.surfaceType, event)}
                />
              ) : null}
              <SurfaceRouter
                item={toSurfaceItem(beat)}
                accessibilitySettings={accessibility}
                onSubmitAndAdvance={submitSurface}
                onEvent={emitSurfaceTelemetry}
              />
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
              {beat.media ? (
                <LessonMedia
                  media={beat.media}
                  onTelemetry={(event) => emitMediaTelemetry(beat.media!.surfaceType, event)}
                />
              ) : null}
              <SurfaceRouter
                item={toSurfaceItem(beat)}
                accessibilitySettings={accessibility}
                onSubmitAndAdvance={submitSurface}
                onEvent={emitSurfaceTelemetry}
              />
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

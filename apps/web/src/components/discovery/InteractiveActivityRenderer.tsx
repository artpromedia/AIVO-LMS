"use client";
/**
 * Surface-aware activity renderer used by the discovery adventure.
 * Falls back to the legacy `ActivityRenderer` for older choice-only
 * activities. Diagnostic-mode activities (`feedbackMode ===
 * "no_correctness_feedback_diagnostic"`) emit a neutral
 * acknowledgement instead of revealing correctness.
 */
import { useRef } from "react";
import {
  SurfaceHost,
  type SurfaceResponse,
  type SurfaceTelemetryEvent,
} from "@aivo/learner-surfaces";
import type { Activity, AdventureChapter } from "./types";
import ActivityRenderer from "./ActivityRenderer";

export interface InteractiveActivityRendererProps {
  activity: Activity;
  chapter: AdventureChapter;
  activityNumber: number;
  totalActivities: number;
  onAnswer: (correct: boolean, latencyMs: number, payload?: Record<string, unknown>) => void;
  onSkip: () => void;
  onSurfaceEvent?: (event: SurfaceTelemetryEvent) => void;
}

function evaluateExactAnswer(activity: Activity, response: SurfaceResponse): boolean {
  const expected = activity.scoring?.correctAnswer ?? activity.surface?.scoring.correctAnswer;
  if (expected === undefined || expected === null) return false;
  const submitted = response.answer ?? response.selectedChoiceId;
  if (typeof expected === "number") {
    const numeric =
      typeof submitted === "number" ? submitted : Number(String(submitted ?? "").trim());
    return Number.isFinite(numeric) && numeric === expected;
  }
  if (typeof expected === "boolean") {
    return Boolean(submitted) === expected;
  }
  return (
    String(submitted ?? "")
      .trim()
      .toLowerCase() === String(expected).trim().toLowerCase()
  );
}

export default function InteractiveActivityRenderer(props: InteractiveActivityRendererProps) {
  const { activity, chapter, activityNumber, totalActivities, onAnswer, onSkip, onSurfaceEvent } =
    props;
  const startRef = useRef<number>(Date.now());

  if (!activity.surface) {
    return (
      <ActivityRenderer
        activity={activity}
        chapter={chapter}
        activityNumber={activityNumber}
        totalActivities={totalActivities}
        onAnswer={onAnswer}
        onSkip={onSkip}
      />
    );
  }

  const surface = activity.surface;
  const isDiagnostic = activity.feedbackMode === "no_correctness_feedback_diagnostic";
  const scoringMode = activity.scoring?.mode ?? surface.scoring.mode;

  const handleSubmit = (response: SurfaceResponse) => {
    const latencyMs = Date.now() - startRef.current;
    const inkStrokeCount = response.inkStrokes?.length ?? 0;
    const erasureCount = response.inkStrokes?.filter((s) => s.tool === "eraser").length ?? 0;

    const basePayload: Record<string, unknown> = {
      surfaceId: surface.id,
      activityId: activity.id,
      domain: activity.domain ?? chapter.domain,
      interaction: activity.interaction,
      finalAnswer: response.answer ?? response.selectedChoiceId,
      inkStrokeCount,
      erasureCount,
      scratchpadUsed: inkStrokeCount > 0,
      latencyMs,
      diagnostic: isDiagnostic,
      scoringMode,
    };

    if (isDiagnostic) {
      // Diagnostic items are never marked wrong locally — we always
      // accept the attempt and let the backend score it.
      onAnswer(true, latencyMs, { ...basePayload, requiresServerScoring: true });
      return;
    }

    if (
      scoringMode === "exact" ||
      (scoringMode === "hybrid" &&
        (activity.scoring?.correctAnswer ?? surface.scoring.correctAnswer) !== undefined)
    ) {
      const correct = evaluateExactAnswer(activity, response);
      onAnswer(correct, latencyMs, { ...basePayload, correct });
      return;
    }

    onAnswer(true, latencyMs, { ...basePayload, requiresServerScoring: true });
  };

  return (
    <div className="fixed inset-0 vi-bg tier-scene-bg flex flex-col overflow-hidden pt-20">
      <div className="max-w-3xl mx-auto w-full px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            {chapter.landmark.emoji}
          </span>
          <span className="text-slate-600 text-xs font-extrabold">{chapter.title}</span>
        </div>
        <div
          className="flex items-center gap-1.5"
          role="progressbar"
          aria-valuenow={activityNumber}
          aria-valuemax={totalActivities}
          aria-valuemin={1}
        >
          {Array.from({ length: totalActivities }).map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i < activityNumber - 1
                  ? "w-6 bg-[hsl(262_83%_58%)]"
                  : i === activityNumber - 1
                    ? "w-8 bg-[hsl(262_83%_58%)]"
                    : "w-2 bg-slate-200"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 overflow-y-auto">
        <SurfaceHost surface={surface} onSubmit={handleSubmit} onEvent={onSurfaceEvent} />
        {isDiagnostic ? (
          <p className="vi-text-muted text-xs text-center mt-3">
            Thanks, I learned how you solve that.
          </p>
        ) : null}
      </div>
    </div>
  );
}

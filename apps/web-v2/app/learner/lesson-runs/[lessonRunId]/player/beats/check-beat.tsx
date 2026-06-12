"use client";

/**
 * Sprint 12 — check-for-understanding beat: prompt, optional captioned
 * media, the interactive surface, and feedback / agent-scaffold callouts.
 * Markup moved verbatim from the original lesson-player.tsx check branch.
 */
import { useTranslations } from "next-intl";
import { MathText } from "@/components/learning/math-text";
import {
  SurfaceRouter,
  type SurfaceRouterItem,
  type SurfaceRouterSubmitResult,
  type SurfaceTelemetryEvent,
} from "@aivo/learner-surfaces";
import type { AccessibilityPreferences } from "@/lib/db/types";
import type { Beat } from "../beats";
import { LessonMedia } from "../lesson-media";

export interface CheckBeatProps {
  beat: Extract<Beat, { kind: "check" }>;
  surfaceItem: SurfaceRouterItem;
  accessibilitySettings: AccessibilityPreferences;
  feedback: null | "correct" | "incorrect";
  agentScaffold: string | null;
  onSubmit: (result: SurfaceRouterSubmitResult) => void;
  onSurfaceEvent: (event: SurfaceTelemetryEvent) => void;
  onMediaTelemetry: (surfaceType: "video" | "audio", event: string) => void;
}

export function CheckBeat({
  beat,
  surfaceItem,
  accessibilitySettings,
  feedback,
  agentScaffold,
  onSubmit,
  onSurfaceEvent,
  onMediaTelemetry,
}: CheckBeatProps) {
  const t = useTranslations("learner.lesson_player");
  return (
    <>
      <p className="font-display text-2xl">
        <MathText>{beat.prompt}</MathText>
      </p>
      {beat.media ? (
        <LessonMedia
          media={beat.media}
          onTelemetry={(event) => onMediaTelemetry(beat.media!.surfaceType, event)}
        />
      ) : null}
      <SurfaceRouter
        item={surfaceItem}
        accessibilitySettings={accessibilitySettings}
        onSubmitAndAdvance={onSubmit}
        onEvent={onSurfaceEvent}
      />
      {feedback === "correct" && (
        <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
          {t("check_correct")}
        </p>
      )}
      {feedback === "incorrect" && (
        <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-900">
          {t("check_close")} <MathText>{beat.supportIfWrong}</MathText>
        </p>
      )}
      {agentScaffold && (
        <p
          data-testid="agent-scaffold"
          className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"
        >
          {t("agent_scaffold_prefix")} <MathText>{agentScaffold}</MathText>
        </p>
      )}
    </>
  );
}

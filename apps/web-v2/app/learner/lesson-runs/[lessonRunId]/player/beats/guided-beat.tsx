"use client";

/**
 * Sprint 12 — guided-practice beat: prompt, optional captioned media, the
 * interactive surface, hint / feedback / agent-scaffold callouts, and the
 * hint + "show me how" buttons. Markup moved verbatim from the original
 * lesson-player.tsx guided branch.
 */
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/learning/math-text";
import {
  SurfaceRouter,
  type SurfaceRouterItem,
  type SurfaceRouterSubmitResult,
  type SurfaceTelemetryEvent,
} from "@aivo/learner-surfaces";
import type { TutorKey } from "@aivo/brand";
import type { AccessibilityPreferences } from "@/lib/db/types";
import type { Beat } from "../beats";
import { LessonMedia } from "../lesson-media";
import { AnswerFeedback } from "./answer-feedback";

export interface GuidedBeatProps {
  beat: Extract<Beat, { kind: "guided" }>;
  surfaceItem: SurfaceRouterItem;
  accessibilitySettings: AccessibilityPreferences;
  feedback: null | "correct" | "incorrect";
  motionOff: boolean;
  tutorSlug: TutorKey | null;
  showHint: boolean;
  agentScaffold: string | null;
  onSubmit: (result: SurfaceRouterSubmitResult) => void;
  onSurfaceEvent: (event: SurfaceTelemetryEvent) => void;
  onMediaTelemetry: (surfaceType: "video" | "audio", event: string) => void;
  onRequestHint: () => void;
  onUseScaffold: () => void;
}

export function GuidedBeat({
  beat,
  surfaceItem,
  accessibilitySettings,
  feedback,
  motionOff,
  tutorSlug,
  showHint,
  agentScaffold,
  onSubmit,
  onSurfaceEvent,
  onMediaTelemetry,
  onRequestHint,
  onUseScaffold,
}: GuidedBeatProps) {
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
      {showHint && (
        <p className="rounded-md bg-iw-warning-subtle p-3 text-sm text-iw-warning-strong">
          {t("hint_prefix")} <MathText>{beat.hint}</MathText>
        </p>
      )}
      {feedback === "correct" && (
        <AnswerFeedback tone="correct" motionOff={motionOff} tutorSlug={tutorSlug}>
          {t("nice_work")}
        </AnswerFeedback>
      )}
      {feedback === "incorrect" && (
        <AnswerFeedback tone="incorrect" motionOff={motionOff} tutorSlug={tutorSlug}>
          {t("not_quite")} <MathText>{beat.scaffold}</MathText>
        </AnswerFeedback>
      )}
      {agentScaffold && (
        <p
          data-testid="agent-scaffold"
          className="rounded-md bg-iw-warning-subtle p-3 text-sm text-iw-warning-strong"
        >
          {t("agent_scaffold_prefix")} <MathText>{agentScaffold}</MathText>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="soft" onClick={onRequestHint} disabled={showHint}>
          {t("hint_btn")}
        </Button>
        <Button variant="ghost" onClick={onUseScaffold}>
          {t("show_me_how")}
        </Button>
      </div>
    </>
  );
}

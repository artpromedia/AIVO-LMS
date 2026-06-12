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
import type { AccessibilityPreferences } from "@/lib/db/types";
import type { Beat } from "../beats";
import { LessonMedia } from "../lesson-media";

export interface GuidedBeatProps {
  beat: Extract<Beat, { kind: "guided" }>;
  surfaceItem: SurfaceRouterItem;
  accessibilitySettings: AccessibilityPreferences;
  feedback: null | "correct" | "incorrect";
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
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          {t("hint_prefix")} <MathText>{beat.hint}</MathText>
        </p>
      )}
      {feedback === "correct" && (
        <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
          {t("nice_work")}
        </p>
      )}
      {feedback === "incorrect" && (
        <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-900">
          {t("not_quite")} <MathText>{beat.scaffold}</MathText>
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

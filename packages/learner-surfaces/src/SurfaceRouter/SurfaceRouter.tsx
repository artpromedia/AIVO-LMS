import { useRef } from "react";
import { ArtCanvasSurface } from "../surfaces/ArtCanvasSurface.js";
import { ChoiceGridSurface } from "../surfaces/ChoiceGridSurface.js";
import { CodingSandboxSurface } from "../surfaces/CodingSandboxSurface.js";
import { GeometrySurface } from "../surfaces/GeometrySurface.js";
import { MathExpressionSurface } from "../surfaces/MathExpressionSurface.js";
import { NumberLineSurface } from "../surfaces/NumberLineSurface.js";
import { ScratchpadSurface } from "../surfaces/ScratchpadSurface.js";
import { VoiceResponseSurface } from "../surfaces/VoiceResponseSurface.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";
import type {
  AnswerInputSpec,
  ArtCanvasSpec,
  CodingSandboxSpec,
  GeometryDiagramSpec,
  LearnerSurfaceSpec,
  ScratchpadSpec,
  SurfaceAccessibilitySpec,
  SurfaceResponse,
  VoiceResponseSpec,
} from "../types.js";
import {
  ITEM_TYPE_TO_RUNTIME,
  type ItemAuthoredSurfaceType,
  type RouterSurfaceType,
  toRuntimeSurfaceType,
} from "./surface-type-map.js";

export type SurfaceRouterItem = {
  id: string;
  /**
   * Either a runtime `LearnerSurfaceType` (what the lesson player emits
   * from beats) or an authored item-bank surface type. The router
   * normalises both via `toRuntimeSurfaceType` so callers can pass
   * whichever they have.
   */
  surfaceType: RouterSurfaceType;
  prompt: string;
  instructions?: string;
  choices?: string[];
  expectedAnswer?: string;
  answerInput?: AnswerInputSpec;
  scratchpad?: ScratchpadSpec;
  diagram?: GeometryDiagramSpec;
  numberLine?: { min: number; max: number; step: number };
  codingSandbox?: CodingSandboxSpec;
  artCanvas?: ArtCanvasSpec;
  voiceResponse?: VoiceResponseSpec;
  accessibility?: Partial<SurfaceAccessibilitySpec>;
};

export type SurfaceRouterAccessibilitySettings = {
  reducedMotion?: boolean;
  highContrast?: boolean;
  largeText?: boolean;
  dyslexiaFriendlyFont?: boolean;
};

export interface SurfaceRouterSubmitResult {
  response: SurfaceResponse;
  isCorrect: boolean | null;
}

export interface SurfaceRouterProps {
  item: SurfaceRouterItem;
  disabled?: boolean;
  accessibilitySettings?: SurfaceRouterAccessibilitySettings;
  onSubmitAndAdvance: (result: SurfaceRouterSubmitResult) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
}

function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function defaultAnswerInput(
  runtimeType: LearnerSurfaceSpec["type"],
  authoredType: RouterSurfaceType,
): AnswerInputSpec {
  if (runtimeType === "choice_grid" || runtimeType === "scratchpad") {
    return { type: "none" };
  }
  if (authoredType === "fill_in_blank") {
    return { type: "text", label: "Fill in the blank" };
  }
  if (authoredType === "short_response") {
    return { type: "text", label: "Your answer" };
  }
  return { type: "text", label: "Your answer" };
}

function buildSurfaceSpec(item: SurfaceRouterItem): LearnerSurfaceSpec {
  const runtimeType = toRuntimeSurfaceType(item.surfaceType);
  return {
    id: item.id,
    type: runtimeType,
    prompt: item.prompt,
    instructions: item.instructions,
    choices: item.choices?.map((label, index) => ({ id: `choice-${index + 1}`, label })),
    scratchpad: item.scratchpad,
    diagram: item.diagram,
    answerInput: item.answerInput ?? defaultAnswerInput(runtimeType, item.surfaceType),
    numberLine: item.numberLine,
    codingSandbox: item.codingSandbox,
    artCanvas: item.artCanvas,
    voiceResponse: item.voiceResponse,
    capture: {
      finalAnswer: true,
      inkStrokes:
        runtimeType === "scratchpad" ||
        runtimeType === "geometry_workspace" ||
        runtimeType === "art_canvas",
      toolChanges: true,
    },
    scoring: { mode: "exact", correctAnswer: item.expectedAnswer },
    accessibility: {
      altText: item.accessibility?.altText ?? item.prompt,
      keyboardAlternative: item.accessibility?.keyboardAlternative ?? true,
      reduceMotionSafe: item.accessibility?.reduceMotionSafe ?? true,
      screenReaderSummary: item.accessibility?.screenReaderSummary ?? item.instructions,
    },
  };
}

export function SurfaceRouter({
  item,
  disabled = false,
  accessibilitySettings,
  onSubmitAndAdvance,
  onEvent,
}: SurfaceRouterProps) {
  const startedRef = useRef(false);
  const surface = buildSurfaceSpec(item);
  const className = [
    accessibilitySettings?.reducedMotion ? "" : "transition-all",
    accessibilitySettings?.highContrast ? "bg-aivo-surface text-black" : "",
    accessibilitySettings?.largeText ? "text-lg leading-relaxed" : "",
    accessibilitySettings?.dyslexiaFriendlyFont ? "font-mono tracking-wide" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!startedRef.current) {
    onEvent?.(createSurfaceEvent(surface.id, "surface_started", { type: surface.type }));
    startedRef.current = true;
  }

  const handleSubmit = (response: SurfaceResponse) => {
    const selectedChoiceLabel =
      response.selectedChoiceId && surface.choices
        ? (surface.choices.find((choice) => choice.id === response.selectedChoiceId)?.label ?? "")
        : "";
    const candidate =
      typeof response.selectedChoiceId === "string"
        ? selectedChoiceLabel
        : typeof response.answer === "string"
          ? response.answer
          : response.answer === undefined || response.answer === null
            ? ""
            : String(response.answer);

    const expected = item.expectedAnswer;
    const isCorrect =
      expected && candidate.length > 0 ? normalizeAnswer(expected) === normalizeAnswer(candidate) : null;

    onSubmitAndAdvance({ response, isCorrect });
  };

  const sharedProps = {
    surface,
    disabled,
    onEvent,
    onSubmit: (response: SurfaceResponse) => handleSubmit(response),
  } as const;

  return (
    <div className={className}>
      {surface.type === "choice_grid" ? <ChoiceGridSurface {...sharedProps} /> : null}
      {surface.type === "math_expression" ? <MathExpressionSurface {...sharedProps} /> : null}
      {surface.type === "scratchpad" ? <ScratchpadSurface {...sharedProps} /> : null}
      {surface.type === "geometry_workspace" ? <GeometrySurface {...sharedProps} /> : null}
      {surface.type === "number_line" ? <NumberLineSurface {...sharedProps} /> : null}
      {surface.type === "coding_sandbox" ? <CodingSandboxSurface {...sharedProps} /> : null}
      {surface.type === "art_canvas" ? <ArtCanvasSurface {...sharedProps} /> : null}
      {surface.type === "voice_response" ? <VoiceResponseSurface {...sharedProps} /> : null}
    </div>
  );
}

/** Re-exported so callers can introspect the router's surface coverage. */
export { ITEM_TYPE_TO_RUNTIME, type ItemAuthoredSurfaceType, type RouterSurfaceType };

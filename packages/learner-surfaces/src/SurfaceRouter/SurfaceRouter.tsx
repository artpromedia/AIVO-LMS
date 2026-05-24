import { useRef } from "react";
import { ChoiceGridSurface } from "../surfaces/ChoiceGridSurface.js";
import { GeometrySurface } from "../surfaces/GeometrySurface.js";
import { MathExpressionSurface } from "../surfaces/MathExpressionSurface.js";
import { NumberLineSurface } from "../surfaces/NumberLineSurface.js";
import { ScratchpadSurface } from "../surfaces/ScratchpadSurface.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";
import type {
  AnswerInputSpec,
  GeometryDiagramSpec,
  LearnerSurfaceSpec,
  ScratchpadSpec,
  SurfaceAccessibilitySpec,
  SurfaceResponse,
} from "../types.js";

export type SurfaceRouterItem = {
  id: string;
  surfaceType: "choice_grid" | "math_expression" | "scratchpad" | "geometry_workspace" | "number_line";
  prompt: string;
  instructions?: string;
  choices?: string[];
  expectedAnswer?: string;
  answerInput?: AnswerInputSpec;
  scratchpad?: ScratchpadSpec;
  diagram?: GeometryDiagramSpec;
  numberLine?: { min: number; max: number; step: number };
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

function buildSurfaceSpec(item: SurfaceRouterItem): LearnerSurfaceSpec {
  return {
    id: item.id,
    type: item.surfaceType,
    prompt: item.prompt,
    instructions: item.instructions,
    choices: item.choices?.map((label, index) => ({ id: `choice-${index + 1}`, label })),
    scratchpad: item.scratchpad,
    diagram: item.diagram,
    answerInput:
      item.answerInput ??
      (item.surfaceType === "choice_grid" || item.surfaceType === "scratchpad"
        ? { type: "none" }
        : { type: "text", label: "Your answer" }),
    numberLine: item.numberLine,
    capture: {
      finalAnswer: true,
      inkStrokes: item.surfaceType === "scratchpad" || item.surfaceType === "geometry_workspace",
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

  return (
    <div className={className}>
      {item.surfaceType === "choice_grid" ? (
        <ChoiceGridSurface
          surface={surface}
          disabled={disabled}
          onEvent={onEvent}
          onSubmit={(response) => handleSubmit(response)}
        />
      ) : null}
      {item.surfaceType === "math_expression" ? (
        <MathExpressionSurface
          surface={surface}
          disabled={disabled}
          onEvent={onEvent}
          onSubmit={(response) => handleSubmit(response)}
        />
      ) : null}
      {item.surfaceType === "scratchpad" ? (
        <ScratchpadSurface
          surface={surface}
          disabled={disabled}
          onEvent={onEvent}
          onSubmit={(response) => handleSubmit(response)}
        />
      ) : null}
      {item.surfaceType === "geometry_workspace" ? (
        <GeometrySurface
          surface={surface}
          disabled={disabled}
          onEvent={onEvent}
          onSubmit={(response) => handleSubmit(response)}
        />
      ) : null}
      {item.surfaceType === "number_line" ? (
        <NumberLineSurface
          surface={surface}
          disabled={disabled}
          onEvent={onEvent}
          onSubmit={(response) => handleSubmit(response)}
        />
      ) : null}
    </div>
  );
}

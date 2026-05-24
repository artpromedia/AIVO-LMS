import type { InkStroke } from "./ink/stroke-model.js";

export type LearnerSurfaceType =
  | "choice_grid"
  | "scratchpad"
  | "geometry_workspace"
  | "math_expression"
  | "number_line"
  | "graph"
  | "drag_manipulative"
  | "reading_annotation"
  | "science_diagram"
  | "voice_response"
  | "multi_step_workspace"
  | "coding_sandbox"
  | "art_canvas";

export type FeedbackMode =
  | "immediate_supportive"
  | "delayed_after_item"
  | "delayed_after_block"
  | "no_correctness_feedback_diagnostic";

export type ScoringMode = "exact" | "rubric" | "process" | "hybrid";

export interface Point {
  x: number;
  y: number;
}

export interface LearnerSurfaceSpec {
  id: string;
  type: LearnerSurfaceType;
  prompt: string;
  instructions?: string;
  feedbackMode?: FeedbackMode;
  diagram?: GeometryDiagramSpec;
  scratchpad?: ScratchpadSpec;
  choices?: ChoiceOption[];
  answerInput?: AnswerInputSpec;
  capture: SurfaceCaptureSpec;
  scoring: SurfaceScoringSpec;
  accessibility: SurfaceAccessibilitySpec;
  /** Sprint 8 — set when type === "coding_sandbox". */
  codingSandbox?: CodingSandboxSpec;
  /** Sprint 9 — set when type === "art_canvas". */
  artCanvas?: ArtCanvasSpec;
}

export interface SurfaceCaptureSpec {
  finalAnswer: boolean;
  inkStrokes?: boolean;
  selectedObjects?: boolean;
  dragPath?: boolean;
  latency?: boolean;
  hintUsage?: boolean;
  erasures?: boolean;
  toolChanges?: boolean;
}

export interface SurfaceScoringSpec {
  mode: ScoringMode;
  correctAnswer?: string | number | boolean;
  rubric?: RubricCriterion[];
  misconceptions?: MisconceptionRule[];
}

export interface SurfaceAccessibilitySpec {
  altText: string;
  audioPrompt?: string;
  reduceMotionSafe: boolean;
  keyboardAlternative: boolean;
  screenReaderSummary?: string;
}

export interface RubricCriterion {
  id: string;
  label: string;
  points: number;
  description: string;
}

export interface MisconceptionRule {
  id: string;
  pattern: string;
  feedback: string;
}

export interface ScratchpadSpec {
  enabled: boolean;
  width?: number;
  height?: number;
  background?: "blank" | "grid" | "lined" | "dot";
  tools?: ScratchpadTool[];
}

export type ScratchpadTool =
  | "pencil"
  | "eraser"
  | "undo"
  | "clear"
  | "highlighter"
  | "line"
  | "shape"
  | "ruler"
  | "protractor"
  | "text";

export interface AnswerInputSpec {
  type: "none" | "text" | "number" | "choice" | "expression";
  label?: string;
  unit?: string;
  placeholder?: string;
}

export interface ChoiceOption {
  id: string;
  label: string;
  emoji?: string;
  isCorrect?: boolean;
}

/**
 * Sprint 8 — Coding sandbox surface config. Plain text only; no
 * runtime evaluation is performed in the client. The learner-svc /
 * tutor-svc backend is responsible for any execution. We capture the
 * code as the surface `answer` so existing scoring pipelines work
 * without modification.
 */
export interface CodingSandboxSpec {
  language: "python" | "javascript" | "blockly" | "pseudo";
  starterCode?: string;
  /** Optional non-editable preamble shown above the editor. */
  prelude?: string;
  /** Soft hint shown beneath the editor; not used for scoring. */
  hint?: string;
}

/**
 * Sprint 9 — Art canvas surface config. Reuses the ink stroke model so
 * scoring + replay work the same way as scratchpad/geometry.
 */
export interface ArtCanvasSpec {
  width?: number;
  height?: number;
  /** Color swatches presented to the learner. Defaults to a warm palette. */
  palette?: string[];
  /** When true, the canvas starts with a faint grid for composition. */
  showGuides?: boolean;
}

export interface GeometryDiagramSpec {
  canvasMode: "svg" | "canvas" | "hybrid";
  coordinateSystem?: "none" | "grid" | "cartesian";
  width?: number;
  height?: number;
  shapes: GeometryShape[];
  labels?: GeometryLabel[];
  measurements?: GeometryMeasurement[];
  tools?: GeometryTool[];
}

export type GeometryShape =
  | { id: string; kind: "triangle"; points: Point[]; fill?: string; stroke?: string }
  | {
      id: string;
      kind: "rectangle";
      x: number;
      y: number;
      width: number;
      height: number;
      fill?: string;
      stroke?: string;
    }
  | {
      id: string;
      kind: "circle";
      cx: number;
      cy: number;
      r: number;
      fill?: string;
      stroke?: string;
    }
  | { id: string; kind: "polygon"; points: Point[]; fill?: string; stroke?: string }
  | { id: string; kind: "segment"; start: Point; end: Point; stroke?: string }
  | { id: string; kind: "ray"; start: Point; through: Point; stroke?: string }
  | {
      id: string;
      kind: "angle";
      vertex: Point;
      armA: Point;
      armB: Point;
      label?: string;
      stroke?: string;
    };

export interface GeometryLabel {
  id: string;
  text: string;
  position: Point;
}

export interface GeometryMeasurement {
  id: string;
  text: string;
  position: Point;
  targetShapeId?: string;
}

export type GeometryTool =
  | "select"
  | "move"
  | "rotate"
  | "ruler"
  | "protractor"
  | "draw_line"
  | "label";

export interface SurfaceResponse {
  surfaceId: string;
  answer?: string | number | boolean;
  selectedChoiceId?: string;
  inkStrokes?: InkStroke[];
  geometryActions?: GeometryAction[];
  durationMs?: number;
  /** Sprint 10 — set when type === "voice_response". */
  voiceResponse?: VoiceResponsePayload;
}

/**
 * Sprint 10 — Recorded learner audio. The blob is encoded as a base64
 * data URL so it can survive JSON transport to the scoring service;
 * the service is responsible for routing it to whatever STT/grading
 * pipeline applies (the same `/api/ai/transcribe` route used by
 * `useSpeechInput` is the obvious fit). The `transcript` field is
 * optional — populated when the browser's Web Speech API is available
 * and produced a usable hypothesis client-side.
 */
export interface VoiceResponsePayload {
  audioDataUrl: string;
  mimeType: string;
  durationMs: number;
  transcript?: string;
}

/**
 * A single learner-driven manipulation of a geometry diagram. Captured
 * during interactive geometry sessions so scoring + analytics can replay
 * the construction (Sprint 05).
 */
export type GeometryAction =
  | {
      type: "move_shape";
      shapeId: string;
      from: Point;
      to: Point;
      at: number;
    }
  | {
      type: "place_label";
      labelId: string;
      text: string;
      position: Point;
      at: number;
    }
  | {
      type: "measure";
      measurementId: string;
      tool: "ruler" | "protractor";
      value: number;
      unit: "px" | "deg";
      from?: Point;
      to?: Point;
      at: number;
    };

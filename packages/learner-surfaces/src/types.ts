import type { CodingLanguage, CodingRubricTest } from "./CodingSandbox/types.js";
import type { InkStroke } from "./ink/stroke-model.js";

export type LearnerSurfaceType =
  | "choice_grid"
  | "scratchpad"
  | "geometry_workspace"
  | "math_expression"
  | "video"
  | "audio"
  | "number_line"
  | "graph"
  | "drag_manipulative"
  | "reading_annotation"
  | "science_diagram"
  | "voice_response"
  | "multi_step_workspace"
  | "coding_sandbox"
  | "art_canvas"
  | "music_sequencer";

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
  /** Sprint 4.3 — set when type === "voice_response". */
  voiceResponse?: VoiceResponseSpec;
  /** Sprint — set when type === "number_line". */
  numberLine?: NumberLineSpec;
  /** Sprint — set when type === "video" | "audio" | "media". */
  media?: MediaSurfaceSpec;
  /** Sprint 4 — set when type === "reading_annotation". */
  readingAnnotation?: ReadingAnnotationSpec;
  /** Sprint 5 — set when type === "graph". */
  graph?: GraphSpec;
  /** Sprint 5 — set when type === "drag_manipulative". */
  dragManipulative?: DragManipulativeSpec;
  /** Sprint 5 — set when type === "multi_step_workspace". */
  multiStep?: MultiStepSpec;
  /** Sprint 6 — set when type === "science_diagram". */
  scienceDiagram?: ScienceDiagramSpec;
  /** Sprint 8 — set when type === "music_sequencer". */
  musicSequencer?: MusicSequencerSpec;
}

/**
 * Sprint 8 — Music/rhythm step sequencer (cadence). A grid of instrument tracks
 * × beats; the learner toggles cells to build a rhythm pattern. Optional audio
 * playback ticks the beats. Captures the pattern as the response.
 */
export interface MusicSequencerSpec {
  /** Instrument row labels (e.g. ["Clap", "Drum", "Shaker"]). */
  tracks: string[];
  /** Number of beats (columns). Default 8. */
  steps?: number;
  /** Playback tempo in beats per minute. Default 90. */
  tempo?: number;
  /** Expected active step indices per track, for scoring. */
  expectedPattern?: number[][];
}

export interface MusicSequencerResponse {
  /** pattern[trackIndex] = sorted active step indices. */
  pattern: number[][];
}

/**
 * Sprint 4 — Reading annotation surface (sage / ELA).
 *
 * The passage is pre-tokenized into addressable spans (sentence or phrase
 * level). The learner highlights/underlines the spans that answer a
 * comprehension prompt; the response captures the selected span ids as cited
 * evidence. Rendering is by index only — no raw HTML — so AI-authored passages
 * can never inject markup.
 */
export interface ReadingAnnotationSpan {
  /** Stable id used for selection + scoring. */
  id: string;
  /** Plain text of this span. */
  text: string;
  /** When false, the span is shown but cannot be selected. Defaults to true. */
  selectable?: boolean;
  /** When true, a paragraph break is rendered after this span. */
  breakAfter?: boolean;
}

export type ReadingAnnotationTool = "highlight" | "underline";

export interface ReadingAnnotationSpec {
  passage: ReadingAnnotationSpan[];
  /** Annotation tools available to the learner. Defaults to ["highlight"]. */
  tools?: ReadingAnnotationTool[];
  /** Span ids that constitute the correct textual evidence (for scoring). */
  expectedEvidenceIds?: string[];
  /** Optional comprehension question shown above the passage. */
  question?: string;
}

export interface ReadingAnnotationResponse {
  selectedSpanIds: string[];
  tool: ReadingAnnotationTool;
}

/**
 * Sprint 5 — Coordinate-plane graphing surface (nova / spark). The learner
 * plots points (and optionally connects them) on a deterministic grid.
 */
export interface GraphSpec {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  step?: number;
  /** "points" lets the learner place discrete points; "line" connects them. */
  mode?: "points" | "line";
  /** Expected points for scoring (order-independent for "points"). */
  expectedPoints?: Point[];
  /** Tolerance (in grid units) when matching a plotted point. Default 0. */
  tolerance?: number;
}

export interface GraphResponse {
  points: Point[];
}

/**
 * Sprint 5 — Drag-and-place manipulative (nova early math / compass exec-fn):
 * the learner drags tokens into labelled targets (bins, slots, a number frame).
 */
export interface DragManipulativeItem {
  id: string;
  label: string;
  emoji?: string;
}

export interface DragManipulativeTarget {
  id: string;
  label: string;
  /** Max tokens this target accepts (omit for unlimited). */
  capacity?: number;
}

export interface DragManipulativeSpec {
  items: DragManipulativeItem[];
  targets: DragManipulativeTarget[];
  /** Correct itemId -> targetId mapping for scoring. */
  correctPlacement?: Record<string, string>;
}

export interface DragManipulativeResponse {
  /** itemId -> targetId for every placed token. */
  placement: Record<string, string>;
}

/**
 * Sprint 5 — Multi-step workspace (nova / spark): a structured solver where
 * each step is entered and validated independently so process telemetry is
 * captured (not just a single final answer).
 */
export interface MultiStepStep {
  id: string;
  prompt: string;
  /** Expected answer for this step (string-compared after normalization). */
  expectedAnswer?: string;
  hint?: string;
}

export interface MultiStepSpec {
  steps: MultiStepStep[];
}

export interface MultiStepResponse {
  /** stepId -> learner entry. */
  entries: Record<string, string>;
}

/**
 * Sprint 6 — Science diagram labelling (spark). A safe, deterministic diagram
 * (reusing `GeometryDiagramSpec` primitives) with positioned drop-targets the
 * learner labels from a bank (e.g. label the cell, the water cycle, circuit
 * parts). Optionally captures observation rows for an experiment.
 */
export interface ScienceDiagramTarget {
  id: string;
  /** Position in the diagram's coordinate space (matches diagram width/height). */
  x: number;
  y: number;
  /** Correct label id for scoring (omit for ungraded/observational targets). */
  correctLabelId?: string;
}

export interface ScienceDiagramLabel {
  id: string;
  text: string;
}

export interface ScienceDiagramSpec {
  /** Safe background visual rendered via `renderGeometrySvg`. */
  diagram?: GeometryDiagramSpec;
  /** Coordinate space for target positions (defaults to the diagram size). */
  width?: number;
  height?: number;
  targets: ScienceDiagramTarget[];
  labels: ScienceDiagramLabel[];
}

export interface ScienceDiagramResponse {
  /** targetId -> labelId placed by the learner. */
  placement: Record<string, string>;
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
  language: CodingLanguage;
  starterCode?: string;
  /**
   * Item correctness rubric used by the in-browser test runner.
   * Hidden tests are executed but learner-visible output only shows
   * pass/fail for those cases.
   */
  correctness?: {
    type: "coding";
    language: CodingLanguage;
    starterCode: string;
    tests: CodingRubricTest[];
  };
  /** Capture raw source in telemetry only when explicitly enabled. */
  captureSource?: boolean;
  /** Optional non-editable preamble shown above the editor. */
  prelude?: string;
  /** Soft hint shown beneath the editor; not used for scoring. */
  hint?: string;
  accessibility?: {
    highContrast?: boolean;
    largeText?: boolean;
    dyslexiaFriendlyFont?: boolean;
  };
}

/**
 * Sprint 4.3 — Voice response surface config.
 */
export interface VoiceResponseSpec {
  /** BCP-47 language code for ASR/scoring (e.g. "en-US", "es-MX"). */
  language: string;
  /** Target text the learner should read/say; used for pronunciation scoring. */
  targetText?: string;
  /** Max recording duration in seconds (default: 60). */
  maxDurationSeconds?: number;
  /**
   * Base URL of the speech-eval-svc POST /evaluate endpoint.
   * Defaults to `/api/speech-eval/evaluate` (same-origin proxy).
   */
  scoreServiceUrl?: string;
}

/**
 * Sprint 4.3 — Art canvas surface config. Reuses the ink stroke model so
 * scoring + replay work the same way as scratchpad/geometry.
 */
export interface ArtCanvasSpec {
  width?: number;
  height?: number;
  /** Color swatches presented to the learner. Defaults to a warm palette. */
  palette?: string[];
  /** Optional high-contrast palette to support low-vision accessibility. */
  highContrastPalette?: string[];
  /** When true, the canvas starts with a faint grid for composition. */
  showGuides?: boolean;
  /** Accessibility overrides mirrored from learner preferences. */
  largeText?: boolean;
  reducedMotion?: boolean;
  dyslexiaFriendlyFont?: boolean;
}

export interface SurfaceAttachment {
  type: "drawing";
  mime: "image/png" | "image/svg+xml";
  url: string;
}

export interface NumberLineSpec {
  min: number;
  max: number;
  step: number;
}

export type SurfaceAssetDescriptor =
  | {
      type: "media";
      src: string;
      mimeType?: string;
    }
  | {
      type: "captions";
      src: string;
      lang: string;
      label?: string;
      default?: boolean;
    };

export interface MediaSurfaceSpec {
  src: string;
  mimeType?: string;
  poster?: string;
  autoPlay?: boolean;
  loop?: boolean;
  assets: SurfaceAssetDescriptor[];
}

export interface SurfaceUserAccessibilityPreferences {
  dyslexiaFriendlyFont?: boolean;
  reducedMotion?: boolean;
  largeText?: boolean;
  captionsAlwaysOn?: boolean;
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
  attachments?: SurfaceAttachment[];
  geometryActions?: GeometryAction[];
  durationMs?: number;
  /** Sprint 10 — set when type === "voice_response". */
  voiceResponse?: VoiceResponsePayload;
  /** Sprint 4 — set when type === "reading_annotation". */
  readingAnnotation?: ReadingAnnotationResponse;
  /** Sprint 5 — set when type === "graph". */
  graph?: GraphResponse;
  /** Sprint 5 — set when type === "drag_manipulative". */
  dragManipulative?: DragManipulativeResponse;
  /** Sprint 5 — set when type === "multi_step_workspace". */
  multiStep?: MultiStepResponse;
  /** Sprint 6 — set when type === "science_diagram". */
  scienceDiagram?: ScienceDiagramResponse;
  /** Sprint 8 — set when type === "music_sequencer". */
  musicSequencer?: MusicSequencerResponse;
}

/**
 * Sprint 4.3 — Recorded learner audio. The blob is encoded as a base64
 * data URL so it can survive JSON transport to the scoring service;
 * the service is responsible for routing it to whatever STT/grading
 * pipeline applies. The `transcript` and `scores` fields are populated
 * after the surface uploads to speech-eval-svc.
 */
export interface VoiceResponsePayload {
  audioDataUrl: string;
  mimeType: string;
  durationMs: number;
  transcript?: string;
  scores?: {
    pronunciation: number;
    fluency: number;
    perWord?: Array<{ word: string; score: number }>;
  };
  /** true when mock/degraded scores were returned by speech-eval-svc */
  degraded?: boolean;
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

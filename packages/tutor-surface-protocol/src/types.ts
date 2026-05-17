export type TutorSurfaceCommandType =
  | "open_scratchpad"
  | "show_geometry"
  | "show_graph"
  | "show_number_line"
  | "show_manipulative"
  | "show_reading_annotation"
  | "show_science_diagram"
  | "collect_answer"
  | "collect_drawing"
  | "highlight_object"
  | "update_label"
  | "save_snapshot";

export type LearnerFunctioningLevel =
  | "NON_VERBAL"
  | "LOW_VERBAL"
  | "PRE_SYMBOLIC"
  | "DEVELOPING"
  | "GRADE_LEVEL"
  | "ADVANCED";

export interface SurfaceAccessibilitySpec {
  altText: string;
  audioPrompt?: string;
  reduceMotionSafe: boolean;
  keyboardAlternative: boolean;
  screenReaderSummary?: string;
}

export interface LearnerSurfaceSpec {
  id: string;
  type: string;
  prompt: string;
  instructions?: string;
  accessibility: SurfaceAccessibilitySpec;
  scratchpad?: { enabled: boolean };
  diagram?: { shapes?: Array<Record<string, unknown>> };
  manipulative?: { kind: string };
  numberLine?: { min: number; max: number };
  capture?: Record<string, unknown>;
  scoring?: Record<string, unknown>;
}

export interface TutorSurfaceCommand {
  id: string;
  commandType: TutorSurfaceCommandType;
  surfaceId: string;
  reason: string;
  expectedLearnerAction?: string;
  profileAdaptationRationale?: string;
  surface?: LearnerSurfaceSpec;
  commandPayload?: Record<string, unknown>;
}

export interface SurfaceProtocolProfile {
  functioningLevel?: LearnerFunctioningLevel;
  accommodations?: string[];
  speechAvailable?: boolean;
  maxResponseTokenBudget?: number;
}

export interface ValidationIssue {
  code: string;
  message: string;
  path?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

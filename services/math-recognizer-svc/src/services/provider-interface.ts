import type { InkStrokeLike } from "./stroke-feature-extractor.js";

export interface RecognizeInput {
  learnerId: string;
  problemSessionId?: string;
  subject: "math";
  skillCode?: string;
  prompt?: string;
  expectedAnswer?: string | number;
  finalAnswer?: string | number;
  strokes?: InkStrokeLike[];
  surfaceSnapshot?: Record<string, unknown>;
  typedWork?: string;
  geometryContext?: Record<string, unknown>;
}

export interface RecognizedStep {
  id: string;
  type: "formula" | "calculation" | "diagram_annotation" | "answer";
  value: string;
  confidence: number;
}

export interface RecognizedMisconception {
  id: string;
  label: string;
  evidence: string;
}

export interface RecognizeOutput {
  recognizedExpression?: string;
  recognizedSteps: RecognizedStep[];
  misconceptions: RecognizedMisconception[];
  feedbackHint?: string;
  correctness?: boolean;
  confidence: number;
}

export interface MathRecognizerProvider {
  recognize(input: RecognizeInput): Promise<RecognizeOutput>;
}

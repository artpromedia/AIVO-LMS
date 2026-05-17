export type ContextType = "lesson" | "homework" | "chat" | "baseline" | "recommendation";

export type Severity = "none" | "low" | "medium" | "high" | "critical";

export type PolicyMode = "warn" | "block";

export type RecommendedAction = "allow" | "revise" | "block" | "escalate";

export interface EvaluateInput {
  learnerId: string;
  tutorSku?: string;
  contextType: ContextType;
  inputSummary: string;
  output: Record<string, unknown> | string;
  learnerProfileSummary?: {
    functioningLevel?: string;
    accommodations?: string[];
    speechAvailable?: boolean;
    requiredSurfaces?: string[];
    declaredFactsInBrain?: string[];
  };
  requiredSurfaces?: string[];
  policyMode: PolicyMode;
}

export interface ViolationReport {
  code: string;
  message: string;
  evidence?: string;
}

export interface EvaluateOutput {
  allowed: boolean;
  severity: Severity;
  violations: ViolationReport[];
  recommendedAction: RecommendedAction;
}

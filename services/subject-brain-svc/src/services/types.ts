export type Subject = "math" | "science" | "ela" | "world_language" | "coding" | "social_studies";

export type FunctioningLevel =
  | "NON_VERBAL"
  | "LOW_VERBAL"
  | "PRE_SYMBOLIC"
  | "DEVELOPING"
  | "GRADE_LEVEL"
  | "ADVANCED";

export interface BrainContextSnapshot {
  accommodations?: string[];
  functioningLevel?: FunctioningLevel;
  deliveryLevel?: string;
  masteryLevels?: Record<string, number>;
  preferredInteractionModes?: string[];
  sensoryProfile?: Record<string, unknown>;
  languageProfile?: Record<string, unknown>;
}

export interface SubjectContextRequest {
  learnerId: string;
  subject: Subject;
  topic?: string;
  gradeTarget?: string;
  deliveryLevel?: string;
  functioningLevel?: FunctioningLevel;
  brainContext: BrainContextSnapshot;
}

export interface MasteryGap {
  skillCode: string;
  mastery: number;
  severity: "low" | "medium" | "high";
}

export interface MisconceptionRisk {
  id: string;
  label: string;
  intervention: string;
}

export interface StandardReference {
  framework: string;
  code: string;
  description: string;
}

export interface SubjectContextResponse {
  subject: Subject;
  topic?: string;
  relevantSkills: string[];
  prerequisiteSkills: string[];
  masteryGaps: MasteryGap[];
  misconceptionRisks: MisconceptionRisk[];
  recommendedSurfaces: string[];
  recommendedScaffolds: string[];
  standards: StandardReference[];
  profileAdaptations: string[];
}

export interface SubjectBrain {
  subject: Subject;
  context(request: SubjectContextRequest): SubjectContextResponse;
}

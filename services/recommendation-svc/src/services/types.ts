export type ProfileRecommendationType =
  | "accommodation_add"
  | "accommodation_remove"
  | "functioning_level_change"
  | "delivery_level_change"
  | "mastery_adjustment"
  | "preferred_surface_change"
  | "tutor_strategy_change"
  | "self_regulation_support_add"
  | "sensory_setting_change"
  | "language_support_change"
  | "rebaseline_request"
  | "teacher_review_request";

export type EvidenceSource =
  | "baseline"
  | "lesson"
  | "homework"
  | "problem_session"
  | "teacher_observation"
  | "parent_observation"
  | "regression_check";

export interface RecommendationEvidence {
  source: EvidenceSource;
  summary: string;
  occurredAt?: string;
  metric?: string;
  value?: number | string | boolean;
}

export interface RecommendationSafety {
  requiresParentApproval: true;
  affectsIEP: boolean;
  affectsInstructionalAccess: boolean;
  reversible: boolean;
}

export type RecommendationStatus =
  | "PENDING"
  | "APPROVED"
  | "AMENDED"
  | "DECLINED"
  | "APPLIED"
  | "FAILED";

export interface ProfileRecommendation {
  id: string;
  learnerId: string;
  type: ProfileRecommendationType;
  title: string;
  parentSummary: string;
  currentValue: unknown;
  proposedValue: unknown;
  amendedValue?: unknown;
  confidence: number;
  evidence: RecommendationEvidence[];
  safety: RecommendationSafety;
  status: RecommendationStatus;
  createdAt: string;
  updatedAt: string;
  appliedAt?: string;
  declineReason?: string;
}

export interface BrainSnapshot {
  learnerId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  createdAt: string;
}

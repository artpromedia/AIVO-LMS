export const K8_CURRICULUM_SCHEMA_VERSION = "2026-05-18.k8-authoring.v1" as const;

export type CurriculumSubject = "math" | "ela" | "science" | "writing";
export type K8GradeBand = "K" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
export type ReviewStatus = "draft" | "sme_review_required" | "sme_approved" | "rejected";
export type ReviewerRole =
  | "math_curriculum_designer"
  | "ela_curriculum_designer"
  | "science_curriculum_designer"
  | "writing_curriculum_designer"
  | "sped_specialist"
  | "assessment_specialist"
  | "district_reviewer";

export type CognitiveLevel =
  | "remember"
  | "understand"
  | "apply"
  | "analyze"
  | "evaluate"
  | "create";

export type ItemQuestionType =
  | "multiple-choice"
  | "multiple-select"
  | "short-answer"
  | "matching"
  | "ordering"
  | "fill-blank"
  | "true-false"
  | "constructed-response";

export interface ExpertReview {
  status: ReviewStatus;
  reviewerRole?: ReviewerRole;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

export interface AccessibilitySupport {
  category:
    | "presentation"
    | "response"
    | "setting"
    | "timing"
    | "language"
    | "executive_function"
    | "sensory";
  support: string;
  preservesConstruct: boolean;
}

export interface StandardReference {
  code: string;
  framework: string;
  jurisdiction?: string;
  description: string;
  strand?: string;
}

export interface MasteryCriteria {
  minAccuracy: number;
  minOpportunities: number;
  retentionWindowDays: number;
}

export interface SkillNode {
  id: string;
  subject: CurriculumSubject;
  gradeBand: K8GradeBand;
  domain: string;
  strand: string;
  title: string;
  description: string;
  standardCodes: string[];
  prerequisiteSkillIds: string[];
  masteryCriteria: MasteryCriteria;
  accessibilitySupports: AccessibilitySupport[];
  review: ExpertReview;
}

export interface LessonTopic {
  title: string;
  objectives: string[];
  durationMin: number;
  lessonType: string;
  materials: string[];
  skillIds: string[];
  standardCodes: string[];
  accessibilitySupports: AccessibilitySupport[];
  review: ExpertReview;
}

export interface UnitBlueprint {
  title: string;
  description: string;
  essentialQuestions: string[];
  bigIdeas: string[];
  durationDays: number;
  skillIds: string[];
  standardCodes: string[];
  lessonTopics: LessonTopic[];
  review: ExpertReview;
}

export interface CurriculumTemplateBlueprint {
  id: string;
  name: string;
  description: string;
  subject: CurriculumSubject;
  gradeBand: K8GradeBand;
  baseStandards: string[];
  tags: string[];
  unitBlueprints: UnitBlueprint[];
  review: ExpertReview;
}

export interface ItemBankItem {
  id: string;
  skillId: string;
  subject: CurriculumSubject;
  gradeBand: K8GradeBand;
  standardCodes: string[];
  questionType: ItemQuestionType;
  prompt: string;
  choices?: Array<{ id: string; text: string; isCorrect: boolean }>;
  correctAnswer?: string | string[];
  scoringRubric?: string;
  cognitiveLevel: CognitiveLevel;
  difficulty: number;
  accessibilitySupports: AccessibilitySupport[];
  review: ExpertReview;
}

export interface K8CurriculumPack {
  schemaVersion: typeof K8_CURRICULUM_SCHEMA_VERSION;
  metadata: {
    name: string;
    version: string;
    academicYear: string;
    publisher: string;
    sourceNotes?: string;
    expertReviews: ExpertReview[];
  };
  standards: StandardReference[];
  skills: SkillNode[];
  templates: CurriculumTemplateBlueprint[];
  itemBankItems: ItemBankItem[];
}

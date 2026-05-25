export type Subject =
  | "math"
  | "science"
  | "ela"
  | "world_language"
  | "coding"
  | "social_studies"
  | "social_emotional"
  | "executive_function"
  | "life_skills"
  // Sprint D — completion plan additions. Brains live under
  // services/subject-brain-svc/src/brains/{speech,creative-arts,stem-engineering}
  // and are registered in services/index.ts.
  | "speech"
  | "creative_arts"
  | "stem_engineering"
  // Sprint C.2 — the remaining two brains. Music drives the `cadence`
  // tutor (ADDON_TUTOR_ARTS); pe_health drives the `vigor` tutor
  // (ADDON_TUTOR_PE_HEALTH). With these the catalog of 14 tutors is
  // fully subject-brain-backed.
  | "music"
  | "pe_health";

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

// --- Sprint 5 adaptive item-selection / scoring contracts -------------------
//
// The pre-Sprint-5 brains only exposed `context()` (a planning helper used
// to pre-stage scaffolds for an upcoming lesson). Sprint 5 introduces a
// minimal item-level loop so SEL / ExecFunc / Life-Skills / Social-Studies
// brains can drive item delivery directly without bolting on a second
// service. The contracts are intentionally lightweight — the brains may
// implement IRT-lite (3PL) where graded, or non-graded reflective scoring
// where pass/fail does not apply (SEL).

export interface Item {
  id: string;
  skillCode: string;
  difficulty: number; // 3PL `b` parameter, theta-space (-3..3)
  discrimination?: number; // 3PL `a`
  guessing?: number; // 3PL `c`
  surface: string; // e.g. "choice_grid", "voice_response", "scratchpad"
  prompt: string;
  options?: string[];
  mediaUrl?: string;
  captionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface LearnerState {
  learnerId: string;
  theta: number; // IRT ability estimate
  masteryLevels: Record<string, number>; // 0..1 by skillCode
  recentItemIds?: string[]; // last N items the learner saw
  functioningLevel?: FunctioningLevel;
  accommodations?: string[];
}

export interface SkillGraphView {
  skills: Array<{
    code: string;
    prerequisites: string[];
    standards: string[];
  }>;
}

export interface ItemResponse {
  itemId: string;
  skillCode: string;
  // For graded brains: 0..1 correctness. For non-graded brains (SEL),
  // this is `null` and the brain uses the qualitative `payload`.
  correctness?: number | null;
  responseTimeMs?: number;
  corrections?: number; // for ExecFunc task-performance proxies
  payload?: Record<string, unknown>;
}

export interface ScoreResult {
  mastery: number; // 0..1
  confidence: number; // 0..1
  feedback: string;
  // SEL emits non-judgmental bands instead of pass/fail.
  band?: "emerging" | "developing" | "consistent" | "reflective";
}

export interface AdaptDirective {
  // Multiplier applied to next item's difficulty (theta-space delta is
  // log(difficultyModulation)). 1.0 = no change.
  difficultyModulation: number;
  // Optional surface override (e.g. drop to a lower-density surface).
  recommendedSurface?: string;
  rationale: string;
}

export interface SubjectBrain {
  subject: Subject;
  context(request: SubjectContextRequest): SubjectContextResponse;
  // Adaptive item-level loop — optional for legacy brains, required for
  // Sprint-5 brains. A brain that returns `undefined` from `selectNextItem`
  // signals "no item available; fall back to authored sequence."
  selectNextItem?(state: LearnerState, graph: SkillGraphView): Item | undefined;
  score?(response: ItemResponse): ScoreResult;
  adapt?(history: ItemResponse[]): AdaptDirective;
}

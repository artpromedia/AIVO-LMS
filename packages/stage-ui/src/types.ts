/** Minimal shared stage types extracted from apps/web/src/components/stage/types.ts */

export type FunctioningLevel = "STANDARD" | "SUPPORTED" | "LOW_VERBAL" | "NON_VERBAL" | "PRE_SYMBOLIC";
export type SensoryLevel = "hyper" | "hypo" | "typical";
export type TutorState = "idle" | "speaking" | "celebrating" | "thinking" | "encouraging" | "pointing";
export type InteractionType = "multiple_choice" | "drag_drop" | "voice" | "draw" | "tap" | "match";
export type SessionPhase = "loading" | "opening" | "warmup" | "core" | "check" | "celebration" | "complete";

export interface SensoryProfile {
  visual: SensoryLevel;
  auditory: SensoryLevel;
  tactile: SensoryLevel;
  vestibular: SensoryLevel;
  proprioceptive: SensoryLevel;
}

export interface SensoryAdaptations {
  colorSaturation: number;
  animationSpeed: number;
  volumeLevel: number;
  maxOnScreenElements: number;
  useSubtitles: boolean;
  hapticIntensity: "off" | "light" | "standard";
  motionReduced: boolean;
  contrastBoost: boolean;
  boldOutlines: boolean;
  pulseAttention: boolean;
}

export interface ChoiceOption {
  id: string;
  label: string;
  emoji?: string;
  image?: string;
  isCorrect: boolean;
}

export interface Beat {
  id: string;
  type: "narration" | "interaction" | "demonstration" | "celebration";
  narration?: string;
  tutorState: TutorState;
  interaction?: {
    type: InteractionType;
    prompt?: string;
    choices?: ChoiceOption[];
    correctAnswer?: string;
  };
  durationMs?: number;
}

export interface SessionState {
  phase: SessionPhase;
  currentBeatIndex: number;
  beats: Beat[];
  totalBeats: number;
  xpEarned: number;
  coinsEarned: number;
  correctCount: number;
  totalAttempts: number;
  startedAt: number;
  learnerId: string;
  sessionId?: string;
  learnerName?: string;
  functioningLevel: FunctioningLevel;
}

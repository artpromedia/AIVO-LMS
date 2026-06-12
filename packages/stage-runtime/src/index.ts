export {
  SessionMachine,
  type TutorSession,
  type SessionSnapshot,
  type AnswerRecord,
} from "./SessionMachine.js";
export type { AgentTransitionDecision } from "./SessionMachine.js";
export { useSessionFlow, type UseSessionFlowResult } from "./useSessionFlow.js";
export {
  useSensoryAdapter,
  type SensoryAdapterApi,
  type UseSensoryAdapterOptions,
} from "./useSensoryAdapter.js";
export {
  deriveSensoryAdaptations,
  deriveRegulationBreak,
  sensoryCSSVars,
  toStageSensoryProfile,
  toStageFunctioningLevel,
  DEFAULT_SENSORY_PROFILE,
  DEFAULT_SENSORY_ADAPTATIONS,
  type DeriveSensoryOptions,
} from "./derive-sensory-adaptations.js";
export { useTTS, type UseTTSResult } from "./useTTS.js";
export {
  useSpeechInput,
  type SpeechInputStatus,
  type SpeechInputError,
  type SpeechInputApi,
  type UseSpeechInputOptions,
} from "./useSpeechInput.js";
export { matchVoiceAnswer, normalizeAnswer, type MatchResult } from "./voiceMatch.js";

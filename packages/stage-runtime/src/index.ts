export {
  SessionMachine,
  type TutorSession,
  type SessionSnapshot,
  type AnswerRecord,
} from "./SessionMachine.js";
export { useSessionFlow, type UseSessionFlowResult } from "./useSessionFlow.js";
export { useSensoryAdapter, type SensoryAdapterApi, _computeSensoryAdaptations } from "./useSensoryAdapter.js";
export { useTTS, type UseTTSResult } from "./useTTS.js";
export {
  useSpeechInput,
  type SpeechInputStatus,
  type SpeechInputError,
  type SpeechInputApi,
  type UseSpeechInputOptions,
} from "./useSpeechInput.js";
export { matchVoiceAnswer, normalizeAnswer, type MatchResult } from "./voiceMatch.js";

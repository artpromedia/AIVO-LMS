// Re-export types shared between web and native implementations.
export type {
  Beat,
  ChoiceOption,
  SessionPhase,
  TutorState,
  FunctioningLevel,
  SensoryLevel,
  SensoryProfile,
  SensoryAdaptations,
  SessionState,
  InteractionType,
} from "./types.js";

// Web (DOM) component exports. Metro's platform extension resolution prefers
// the `.native.tsx` siblings when bundling for React Native, so importing
// from `@aivo/stage-ui` in apps/mobile transparently swaps these for the
// React Native variants. Apps/web and Storybook get these DOM versions.
export { StageLayout } from "./StageLayout.js";
export { StageContent } from "./StageContent.js";
export { BeatPreview } from "./BeatPreview.js";
export { ResponseZone } from "./ResponseZone.js";
export { ProgressPath } from "./ProgressPath.js";
export { CelebrationOverlay } from "./CelebrationOverlay.js";
export { TutorCharacter } from "./TutorCharacter.js";
export { StageBreakCloud } from "./StageBreakCloud.js";

export type { StageLayoutProps } from "./StageLayout.js";
export type { StageBreakCloudProps } from "./StageBreakCloud.js";
export type { StageContentProps } from "./StageContent.js";
export type { BeatPreviewProps } from "./BeatPreview.js";
export type { ResponseZoneProps } from "./ResponseZone.js";
export type { ProgressPathProps } from "./ProgressPath.js";
export type { CelebrationOverlayProps } from "./CelebrationOverlay.js";
export type { TutorCharacterProps } from "./TutorCharacter.js";

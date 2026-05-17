export type {
  TutorSurfaceCommand,
  TutorSurfaceCommandType,
  LearnerSurfaceSpec,
  SurfaceAccessibilitySpec,
  SurfaceProtocolProfile,
  LearnerFunctioningLevel,
  ValidationIssue,
  ValidationResult,
} from "./types.js";

export { validateTutorSurfaceCommand, validateTutorSurfaceCommands } from "./validators.js";

export { buildGeometryCommand } from "./geometry-command.js";
export type { GeometryCommandInput } from "./geometry-command.js";

export { buildScratchpadCommand } from "./scratchpad-command.js";
export type { ScratchpadCommandInput } from "./scratchpad-command.js";

export { buildGraphCommand, buildNumberLineCommand } from "./graph-command.js";
export type { GraphCommandInput, NumberLineCommandInput } from "./graph-command.js";

export { buildReadingAnnotationCommand, buildSaveSnapshotCommand } from "./annotation-command.js";
export type { AnnotationCommandInput, SaveSnapshotCommandInput } from "./annotation-command.js";

export { normalizeTutorSurfaceResponse } from "./runtime-normalizer.js";
export type { NormalizationOutcome } from "./runtime-normalizer.js";

export { validateTutorSurfaceResponse } from "./runtime-validator.js";
export type { TutorSurfaceResponse } from "./runtime-validator.js";

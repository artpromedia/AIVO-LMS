import type { LearnerSurfaceSpec, TutorSurfaceCommand } from "./types.js";

export interface AnnotationCommandInput {
  id: string;
  surfaceId: string;
  reason: string;
  prompt: string;
  altText: string;
  passage?: string;
  expectedLearnerAction?: string;
  profileAdaptationRationale?: string;
}

export function buildReadingAnnotationCommand(input: AnnotationCommandInput): TutorSurfaceCommand {
  const surface: LearnerSurfaceSpec = {
    id: input.surfaceId,
    type: "reading_annotation",
    prompt: input.prompt,
    accessibility: {
      altText: input.altText,
      reduceMotionSafe: true,
      keyboardAlternative: true,
    },
  };
  return {
    id: input.id,
    commandType: "show_reading_annotation",
    surfaceId: input.surfaceId,
    reason: input.reason,
    expectedLearnerAction: input.expectedLearnerAction ?? "annotate_passage",
    profileAdaptationRationale: input.profileAdaptationRationale,
    surface,
    commandPayload: input.passage ? { passage: input.passage } : undefined,
  };
}

export interface SaveSnapshotCommandInput {
  id: string;
  surfaceId: string;
  reason: string;
  snapshotType: "ink" | "diagram" | "annotation" | "text" | "answer";
}

export function buildSaveSnapshotCommand(input: SaveSnapshotCommandInput): TutorSurfaceCommand {
  return {
    id: input.id,
    commandType: "save_snapshot",
    surfaceId: input.surfaceId,
    reason: input.reason,
    commandPayload: { snapshotType: input.snapshotType },
  };
}

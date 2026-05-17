import type { LearnerSurfaceSpec, TutorSurfaceCommand } from "./types.js";

export interface GeometryCommandInput {
  id: string;
  surfaceId: string;
  reason: string;
  prompt: string;
  altText: string;
  shapes: Array<{
    id: string;
    kind: "rectangle" | "triangle" | "circle" | "polygon" | "line" | "angle";
    [key: string]: unknown;
  }>;
  expectedLearnerAction?: string;
  profileAdaptationRationale?: string;
}

export function buildGeometryCommand(input: GeometryCommandInput): TutorSurfaceCommand {
  const surface: LearnerSurfaceSpec = {
    id: input.surfaceId,
    type: "geometry_workspace",
    prompt: input.prompt,
    accessibility: {
      altText: input.altText,
      reduceMotionSafe: true,
      keyboardAlternative: true,
    },
    diagram: { shapes: input.shapes },
    scratchpad: { enabled: true },
  };
  return {
    id: input.id,
    commandType: "show_geometry",
    surfaceId: input.surfaceId,
    reason: input.reason,
    expectedLearnerAction: input.expectedLearnerAction,
    profileAdaptationRationale: input.profileAdaptationRationale,
    surface,
  };
}

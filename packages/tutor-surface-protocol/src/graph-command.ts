import type { LearnerSurfaceSpec, TutorSurfaceCommand } from "./types.js";

export interface GraphCommandInput {
  id: string;
  surfaceId: string;
  reason: string;
  prompt: string;
  altText: string;
  axes: {
    xLabel: string;
    yLabel: string;
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
  expectedLearnerAction?: string;
  profileAdaptationRationale?: string;
}

export function buildGraphCommand(input: GraphCommandInput): TutorSurfaceCommand {
  const surface: LearnerSurfaceSpec = {
    id: input.surfaceId,
    type: "graph",
    prompt: input.prompt,
    accessibility: {
      altText: input.altText,
      reduceMotionSafe: true,
      keyboardAlternative: true,
    },
  };
  return {
    id: input.id,
    commandType: "show_graph",
    surfaceId: input.surfaceId,
    reason: input.reason,
    expectedLearnerAction: input.expectedLearnerAction,
    profileAdaptationRationale: input.profileAdaptationRationale,
    surface,
    commandPayload: { axes: input.axes },
  };
}

export interface NumberLineCommandInput {
  id: string;
  surfaceId: string;
  reason: string;
  prompt: string;
  altText: string;
  min: number;
  max: number;
  step?: number;
  expectedLearnerAction?: string;
  profileAdaptationRationale?: string;
}

export function buildNumberLineCommand(input: NumberLineCommandInput): TutorSurfaceCommand {
  const surface: LearnerSurfaceSpec = {
    id: input.surfaceId,
    type: "number_line",
    prompt: input.prompt,
    accessibility: {
      altText: input.altText,
      reduceMotionSafe: true,
      keyboardAlternative: true,
    },
    numberLine: { min: input.min, max: input.max },
  };
  return {
    id: input.id,
    commandType: "show_number_line",
    surfaceId: input.surfaceId,
    reason: input.reason,
    expectedLearnerAction: input.expectedLearnerAction,
    profileAdaptationRationale: input.profileAdaptationRationale,
    surface,
    commandPayload: { min: input.min, max: input.max, step: input.step ?? 1 },
  };
}

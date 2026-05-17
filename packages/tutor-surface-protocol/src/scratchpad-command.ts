import type { LearnerSurfaceSpec, TutorSurfaceCommand } from "./types.js";

export interface ScratchpadCommandInput {
  id: string;
  surfaceId: string;
  reason: string;
  prompt: string;
  altText: string;
  background?: "blank" | "grid" | "lined" | "dot";
  expectedLearnerAction?: string;
  profileAdaptationRationale?: string;
}

export function buildScratchpadCommand(input: ScratchpadCommandInput): TutorSurfaceCommand {
  const surface: LearnerSurfaceSpec = {
    id: input.surfaceId,
    type: "scratchpad",
    prompt: input.prompt,
    accessibility: {
      altText: input.altText,
      reduceMotionSafe: true,
      keyboardAlternative: true,
    },
    scratchpad: { enabled: true },
  };
  return {
    id: input.id,
    commandType: "open_scratchpad",
    surfaceId: input.surfaceId,
    reason: input.reason,
    expectedLearnerAction: input.expectedLearnerAction ?? "show_work",
    profileAdaptationRationale: input.profileAdaptationRationale,
    surface,
    commandPayload: { background: input.background ?? "grid" },
  };
}

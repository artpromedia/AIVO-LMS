/**
 * Release-gate test: tutor responses must adhere to the learner profile.
 *
 * The tutor surface protocol validator must reject:
 *   - speech-required commands for NON_VERBAL learners (no override)
 *   - long typed responses for LOW_VERBAL / PRE_SYMBOLIC learners
 *   - geometry surfaces without shapes
 *   - missing accessibility alt text
 */
import { describe, expect, it } from "vitest";
import {
  buildGeometryCommand,
  buildScratchpadCommand,
  validateTutorSurfaceCommand,
} from "@aivo/tutor-surface-protocol";

describe("tutor profile adherence release gate", () => {
  it("rejects collect_answer for NON_VERBAL learner", () => {
    const command = buildScratchpadCommand({
      id: "cmd-1",
      surfaceId: "surf-1",
      reason: "ask",
      prompt: "p",
      altText: "alt",
    });
    command.commandType = "collect_answer";
    const result = validateTutorSurfaceCommand(command, {
      functioningLevel: "NON_VERBAL",
      speechAvailable: false,
    });
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("speech_required_for_non_verbal");
  });

  it("rejects long typed response for LOW_VERBAL learner", () => {
    const command = buildScratchpadCommand({
      id: "cmd-1",
      surfaceId: "surf-1",
      reason: "essay",
      prompt: "p",
      altText: "alt",
      expectedLearnerAction: "type_long_response",
    });
    const result = validateTutorSurfaceCommand(command, { functioningLevel: "LOW_VERBAL" });
    expect(result.issues.map((i) => i.code)).toContain("long_text_for_low_verbal");
  });

  it("rejects geometry surface without shapes", () => {
    const command = buildGeometryCommand({
      id: "cmd-1",
      surfaceId: "surf-1",
      reason: "find area",
      prompt: "p",
      altText: "alt",
      shapes: [],
    });
    const result = validateTutorSurfaceCommand(command);
    expect(result.issues.map((i) => i.code)).toContain("geometry_without_shapes");
  });

  it("rejects missing accessibility alt text", () => {
    const command = buildScratchpadCommand({
      id: "cmd-1",
      surfaceId: "surf-1",
      reason: "ask",
      prompt: "p",
      altText: "",
    });
    const result = validateTutorSurfaceCommand(command);
    expect(result.issues.map((i) => i.code)).toContain("missing_alt_text");
  });
});

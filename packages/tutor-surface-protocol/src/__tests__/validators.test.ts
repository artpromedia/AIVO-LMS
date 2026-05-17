import { describe, expect, it } from "vitest";
import {
  buildGeometryCommand,
  buildScratchpadCommand,
  buildReadingAnnotationCommand,
  validateTutorSurfaceCommand,
  validateTutorSurfaceCommands,
} from "../index.js";

describe("validateTutorSurfaceCommand", () => {
  it("accepts a well-formed geometry command", () => {
    const command = buildGeometryCommand({
      id: "cmd-1",
      surfaceId: "surf-1",
      reason: "Compute area of the rectangle.",
      prompt: "Find the area of the rectangle.",
      altText: "A rectangle 8 cm by 4 cm.",
      shapes: [{ id: "r1", kind: "rectangle", width: 8, height: 4 }],
    });
    const result = validateTutorSurfaceCommand(command);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("fails when command id is missing", () => {
    const command = buildScratchpadCommand({
      id: "cmd-x",
      surfaceId: "surf-2",
      reason: "Show work",
      prompt: "Work out the sum",
      altText: "Scratchpad",
    });
    const broken = { ...command, id: "" };
    const result = validateTutorSurfaceCommand(broken);
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("missing_command_id");
  });

  it("fails when surface id is missing", () => {
    const command = buildScratchpadCommand({
      id: "cmd-1",
      surfaceId: "",
      reason: "Show work",
      prompt: "Work out the sum",
      altText: "Scratchpad",
    });
    const result = validateTutorSurfaceCommand(command);
    expect(result.issues.map((i) => i.code)).toContain("missing_surface_id");
  });

  it("rejects unsupported surface type", () => {
    const command = buildGeometryCommand({
      id: "c",
      surfaceId: "s",
      reason: "r",
      prompt: "p",
      altText: "a",
      shapes: [{ id: "r1", kind: "rectangle" }],
    });
    if (command.surface) {
      command.surface.type = "holographic_warp_grid";
    }
    const result = validateTutorSurfaceCommand(command);
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("unsupported_surface_type");
  });

  it("rejects geometry surface with no shapes", () => {
    const command = buildGeometryCommand({
      id: "c",
      surfaceId: "s",
      reason: "r",
      prompt: "p",
      altText: "a",
      shapes: [],
    });
    const result = validateTutorSurfaceCommand(command);
    expect(result.issues.map((i) => i.code)).toContain("geometry_without_shapes");
  });

  it("rejects scratchpad command without ink capture", () => {
    const command = buildScratchpadCommand({
      id: "c",
      surfaceId: "s",
      reason: "r",
      prompt: "p",
      altText: "a",
    });
    if (command.surface?.scratchpad) {
      command.surface.scratchpad.enabled = false;
    }
    const result = validateTutorSurfaceCommand(command);
    expect(result.issues.map((i) => i.code)).toContain("scratchpad_without_ink_capture");
  });

  it("rejects raw HTML injection in reason", () => {
    const command = buildScratchpadCommand({
      id: "c",
      surfaceId: "s",
      reason: "<b>bold</b> reason",
      prompt: "p",
      altText: "a",
    });
    const result = validateTutorSurfaceCommand(command);
    expect(result.issues.map((i) => i.code)).toContain("unsafe_markup");
  });

  it("rejects raw SVG injection in prompt", () => {
    const command = buildScratchpadCommand({
      id: "c",
      surfaceId: "s",
      reason: "r",
      prompt: "<svg><rect/></svg>",
      altText: "a",
    });
    const result = validateTutorSurfaceCommand(command);
    expect(result.issues.map((i) => i.code)).toContain("unsafe_markup");
  });

  it("rejects missing alt text", () => {
    const command = buildScratchpadCommand({
      id: "c",
      surfaceId: "s",
      reason: "r",
      prompt: "p",
      altText: "",
    });
    const result = validateTutorSurfaceCommand(command);
    expect(result.issues.map((i) => i.code)).toContain("missing_alt_text");
  });

  it("rejects speech-required command for NON_VERBAL learner", () => {
    const command = buildReadingAnnotationCommand({
      id: "c",
      surfaceId: "s",
      reason: "r",
      prompt: "p",
      altText: "a",
    });
    command.commandType = "collect_answer";
    const result = validateTutorSurfaceCommand(command, {
      functioningLevel: "NON_VERBAL",
      speechAvailable: false,
    });
    expect(result.issues.map((i) => i.code)).toContain("speech_required_for_non_verbal");
  });

  it("rejects long typed response for LOW_VERBAL learner", () => {
    const command = buildScratchpadCommand({
      id: "c",
      surfaceId: "s",
      reason: "r",
      prompt: "p",
      altText: "a",
      expectedLearnerAction: "type_long_response",
    });
    const result = validateTutorSurfaceCommand(command, { functioningLevel: "LOW_VERBAL" });
    expect(result.issues.map((i) => i.code)).toContain("long_text_for_low_verbal");
  });

  it("flags duplicate command ids in batch validation", () => {
    const a = buildScratchpadCommand({
      id: "dup",
      surfaceId: "s1",
      reason: "r",
      prompt: "p",
      altText: "a",
    });
    const b = buildScratchpadCommand({
      id: "dup",
      surfaceId: "s2",
      reason: "r",
      prompt: "p",
      altText: "a",
    });
    const result = validateTutorSurfaceCommands([a, b]);
    expect(result.issues.map((i) => i.code)).toContain("duplicate_command_id");
  });
});

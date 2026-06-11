/**
 * Wave E (S9) — directive mapping is the client's only interpretation of
 * the agent's validated wire actions; every action kind must map to a
 * defined behaviour and every malformed shape must collapse to "none".
 */
import { describe, expect, it } from "vitest";
import {
  directiveFromDecision,
  PRESENTABLE_SURFACES,
  type AgentWireAction,
} from "../agent-directives";

function decide(action: AgentWireAction | null, kind: "action" | "deterministic" = "action") {
  return directiveFromDecision({ kind, action });
}

describe("directiveFromDecision", () => {
  it("maps deterministic decisions and null actions to none", () => {
    expect(decide(null, "deterministic")).toEqual({ type: "none" });
    expect(decide(null)).toEqual({ type: "none" });
    expect(decide({ kind: "advance" }, "deterministic")).toEqual({ type: "none" });
  });

  it("maps every action kind to its directive", () => {
    expect(decide({ kind: "advance", encouragement: "Nice thinking!" })).toEqual({
      type: "advance",
      encouragement: "Nice thinking!",
    });
    expect(decide({ kind: "advance" })).toEqual({ type: "advance", encouragement: null });
    expect(decide({ kind: "say", text: "You are close." })).toEqual({
      type: "say",
      text: "You are close.",
    });
    expect(decide({ kind: "insert_scaffold", scaffold: "Count up from 3." })).toEqual({
      type: "show_scaffold",
      text: "Count up from 3.",
    });
    expect(
      decide({ kind: "remediate", focus: "equal groups", approach: "worked_example" }),
    ).toEqual({
      type: "insert_remediation",
      focus: "equal groups",
      approach: "worked_example",
    });
    expect(
      decide({ kind: "offer_break", reason: "frustration", duration_seconds: 120 }),
    ).toEqual({ type: "offer_break", reason: "frustration", durationSeconds: 120 });
    expect(decide({ kind: "switch_modality", modality: "visual" })).toEqual({
      type: "switch_modality",
      modality: "visual",
    });
    expect(decide({ kind: "present_surface", surface_type: "number_line" })).toEqual({
      type: "present_surface",
      surfaceType: "number_line",
    });
    expect(decide({ kind: "end_early", reason: "fatigue" })).toEqual({
      type: "end_early",
      reason: "fatigue",
    });
  });

  it("sanitises malformed fields instead of crashing", () => {
    // Missing required text → none (never an empty bubble).
    expect(decide({ kind: "say", text: "   " })).toEqual({ type: "none" });
    expect(decide({ kind: "insert_scaffold" })).toEqual({ type: "none" });
    expect(decide({ kind: "remediate" })).toEqual({ type: "none" });
    // Unknown enum values fall to safe defaults.
    expect(decide({ kind: "remediate", focus: "x y z", approach: "teleport" })).toEqual({
      type: "insert_remediation",
      focus: "x y z",
      approach: "re_explain",
    });
    expect(decide({ kind: "switch_modality", modality: "psychic" })).toEqual({
      type: "none",
    });
    // Break durations clamp to the calm default outside 15..600s.
    expect(decide({ kind: "offer_break", duration_seconds: 5 })).toEqual({
      type: "offer_break",
      reason: "pacing",
      durationSeconds: 60,
    });
    // Unknown kinds (future vocabulary) are a no-op, not a crash.
    expect(decide({ kind: "teleport" } as AgentWireAction)).toEqual({ type: "none" });
  });

  it("allow-lists only surfaces the player can default-spec", () => {
    expect(PRESENTABLE_SURFACES.has("number_line")).toBe(true);
    expect(PRESENTABLE_SURFACES.has("choice_grid")).toBe(true);
    expect(PRESENTABLE_SURFACES.has("geometry_workspace")).toBe(false);
  });
});

/**
 * Sprint 12.6 — smoke test for @aivo/stage-ui.
 *
 * The exported React / RN components need a DOM or Metro runtime to
 * render. We only smoke-test the pure type module (`./types`) which
 * carries the cross-platform contract every renderer must respect.
 * Component-level coverage lives in Storybook + apps/web-v2 e2e.
 */
import { describe, it, expect } from "vitest";
import type {
  FunctioningLevel,
  SensoryLevel,
  TutorState,
  InteractionType,
  SessionPhase,
} from "../src/types";

describe("@aivo/stage-ui smoke", () => {
  it("type module is importable and shapes type-check", () => {
    // Compile-time check: these assignments must succeed with the
    // documented union members. The runtime expectation is just
    // "import resolves without throwing".
    const fl: FunctioningLevel = "STANDARD";
    const sl: SensoryLevel = "typical";
    const ts: TutorState = "idle";
    const it_: InteractionType = "tap";
    const sp: SessionPhase = "core";
    expect([fl, sl, ts, it_, sp].every((v) => typeof v === "string")).toBe(true);
  });
});

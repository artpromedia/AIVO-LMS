import { describe, expect, it } from "vitest";
import {
  classifySteadySignalStage,
  createSteadySignalTheme,
  steadySignalDashboardLayout,
  steadySignalStageColumns,
} from "./steadySignal";

describe("Steady Signal mobile contract", () => {
  it("distinguishes phone, tablet portrait, and tablet landscape", () => {
    expect(classifySteadySignalStage(390, 844)).toBe("phone");
    expect(classifySteadySignalStage(768, 1024)).toBe("tablet-portrait");
    expect(classifySteadySignalStage(1024, 768)).toBe("tablet-landscape");
  });

  it("keeps AAC present on every form factor", () => {
    expect(steadySignalStageColumns("phone").aac).toBe(1);
    expect(steadySignalStageColumns("tablet-portrait").aac).toBe(1);
    expect(steadySignalStageColumns("tablet-landscape").aac).toBe(1);
  });

  it("recomposes family dashboards without stretching the phone layout", () => {
    expect(steadySignalDashboardLayout("phone")).toMatchObject({
      statsColumns: 2,
      heroDirection: "column",
    });
    expect(steadySignalDashboardLayout("tablet-portrait")).toMatchObject({
      statsColumns: 2,
      heroDirection: "row",
    });
    expect(steadySignalDashboardLayout("tablet-landscape")).toMatchObject({
      statsColumns: 4,
      heroDirection: "row",
    });
  });

  it("resolves a native calm, symbol-first learner theme", () => {
    const theme = createSteadySignalTheme({
      sensory: "calm",
      age: "early",
      communication: "symbol-first",
    });
    expect(theme.sensory.motionScale).toBe(0);
    expect(theme.age.minTouchTarget).toBe("64px");
    expect(theme.communication.aacDock).toBe("persistent");
  });
});

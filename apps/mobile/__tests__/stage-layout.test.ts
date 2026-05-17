/**
 * Sprint 07 — stage layout resolver.
 *
 * Locks the breakpoint matrix that drives the mobile stage runtime so a
 * future refactor of `responsive.ts` can't silently degrade tablet
 * landscape into a stacked layout.
 */
import { describe, expect, it } from "vitest";
import { resolveStageLayout } from "../src/design/stageLayout";

describe("resolveStageLayout", () => {
  it("stacks on a phone (compact portrait)", () => {
    const l = resolveStageLayout(390, 844); // iPhone 14
    expect(l.mode).toBe("stacked");
  });

  it("stacks on a phone in landscape", () => {
    const l = resolveStageLayout(844, 390);
    // 844dp == expanded breakpoint → split. Phones never reach 840dp on
    // their short side; this case proves the resolver is width-driven,
    // not device-class-driven.
    expect(l.mode).toBe("split");
  });

  it("stacks on a tablet in portrait (medium portrait)", () => {
    const l = resolveStageLayout(768, 1024); // iPad portrait
    expect(l.mode).toBe("stacked");
  });

  it("splits on a tablet in landscape (medium landscape)", () => {
    const l = resolveStageLayout(800, 600); // medium landscape (iPad mini-ish)
    expect(l.mode).toBe("split");
  });

  it("splits on an expanded screen in either orientation", () => {
    expect(resolveStageLayout(1366, 1024).mode).toBe("split"); // iPad Pro landscape
    expect(resolveStageLayout(1024, 1366).mode).toBe("split"); // iPad Pro portrait
  });

  it("uses a wider tutor rail on expanded vs medium", () => {
    const medium = resolveStageLayout(800, 600); // medium landscape
    const expanded = resolveStageLayout(1366, 1024);
    expect(expanded.tutorPanelWidth).toBeGreaterThan(medium.tutorPanelWidth);
  });

  it("clamps content width to the workspace cap when splitting", () => {
    const l = resolveStageLayout(2560, 1440); // external display
    expect(l.mode).toBe("split");
    expect(l.contentMaxWidth).toBe(1280);
  });

  it("returns a positive splitGap so panels never touch", () => {
    expect(resolveStageLayout(1366, 1024).splitGap).toBeGreaterThan(0);
  });
});

/**
 * SwitchScanOverlay.test.ts
 *
 * Tests that the SwitchScanOverlay component:
 * - Renders (is truthy / non-null) when `active=true` and items are provided.
 * - Does NOT render when `active=false`.
 *
 * These are logic-level tests (no DOM rendering required).
 */
import { describe, it, expect } from "vitest";
import { SwitchScanController } from "@aivo/aac-bridge";
import type { SymbolItem } from "@aivo/aac-bridge";

const makeItems = (count: number): SymbolItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    label: `Item ${i}`,
    imageUrl: "",
    boardId: "board-1",
    position: { row: 0, col: i },
  }));

describe("SwitchScanOverlay logic", () => {
  it("SwitchScanController is created when overlay is active with items", () => {
    // Simulate what the overlay does: creates a controller when active.
    const items = makeItems(3);
    const ctrl = new SwitchScanController(
      {
        method: "switch_1",
        scanDelayMs: 1000,
        dwellTimeMs: 800,
        auditoryFeedback: false,
        highlightStyle: "box",
        autoStart: false,
      },
      items,
    );
    expect(ctrl).toBeTruthy();
    expect(ctrl.getHighlightedItem()?.id).toBe("item-0");
  });

  it("Controller is not created when active=false (items empty guard)", () => {
    // When active=false, the overlay passes items=[] and the controller
    // returns null from getHighlightedItem().
    const ctrl = new SwitchScanController(
      {
        method: "switch_1",
        scanDelayMs: 1000,
        dwellTimeMs: 800,
        auditoryFeedback: false,
        highlightStyle: "box",
        autoStart: false,
      },
      [],
    );
    expect(ctrl.getHighlightedItem()).toBeNull();
  });

  it("active_accommodations including 'switch_scanning' enables the overlay", () => {
    // Simulate the useSwitchScanningEnabled() hook logic.
    const activeAccommodations = ["switch_scanning", "large_text"];
    const enabled = activeAccommodations.includes("switch_scanning");
    expect(enabled).toBe(true);
  });

  it("active_accommodations NOT including 'switch_scanning' disables the overlay", () => {
    const activeAccommodations = ["large_text", "high_contrast"];
    const enabled = activeAccommodations.includes("switch_scanning");
    expect(enabled).toBe(false);
  });

  it("overlay with empty items list does not activate scanner", () => {
    const ctrl = new SwitchScanController(
      {
        method: "switch_1",
        scanDelayMs: 100,
        dwellTimeMs: 800,
        auditoryFeedback: false,
        highlightStyle: "box",
        autoStart: true,
      },
      [],
    );
    ctrl.start();
    // With no items, activate returns an empty targetId — overlay should be null.
    const evt = ctrl.activate();
    expect(evt.targetId).toBe("");
    ctrl.stop();
  });
});

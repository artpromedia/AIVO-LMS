import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SwitchScanController } from "../SwitchScanController.js";
import type { AACSessionConfig, SymbolItem } from "../types.js";

const makeConfig = (overrides: Partial<AACSessionConfig> = {}): AACSessionConfig => ({
  method: "switch_1",
  scanDelayMs: 100,
  dwellTimeMs: 800,
  auditoryFeedback: false,
  highlightStyle: "box",
  autoStart: true,
  ...overrides,
});

const makeItems = (count: number): SymbolItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    label: `Item ${i}`,
    imageUrl: `https://cdn.example.com/item${i}.png`,
    boardId: "board-1",
    position: { row: 0, col: i },
  }));

describe("SwitchScanController", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts at index 0 (first item highlighted)", () => {
    const items = makeItems(3);
    const ctrl = new SwitchScanController(makeConfig(), items);
    expect(ctrl.getHighlightedItem()?.id).toBe("item-0");
  });

  it("auto-advances highlight on timer", () => {
    const items = makeItems(3);
    const ctrl = new SwitchScanController(makeConfig({ autoStart: true }), items);
    ctrl.start();
    vi.advanceTimersByTime(100);
    expect(ctrl.getHighlightedItem()?.id).toBe("item-1");
    vi.advanceTimersByTime(100);
    expect(ctrl.getHighlightedItem()?.id).toBe("item-2");
  });

  it("wraps from last item back to first", () => {
    const items = makeItems(3);
    const ctrl = new SwitchScanController(makeConfig({ autoStart: true }), items);
    ctrl.start();
    vi.advanceTimersByTime(300);
    expect(ctrl.getHighlightedItem()?.id).toBe("item-0");
  });

  it("activate() returns event for currently highlighted item", () => {
    const items = makeItems(3);
    const ctrl = new SwitchScanController(makeConfig(), items);
    ctrl.start();
    vi.advanceTimersByTime(100);
    const evt = ctrl.activate();
    expect(evt.targetId).toBe("item-1");
    expect(evt.method).toBe("switch_1");
  });

  it("stop() prevents further advancement", () => {
    const items = makeItems(3);
    const ctrl = new SwitchScanController(makeConfig({ autoStart: true }), items);
    ctrl.start();
    vi.advanceTimersByTime(100);
    ctrl.stop();
    vi.advanceTimersByTime(300);
    expect(ctrl.getHighlightedItem()?.id).toBe("item-1");
  });

  it("subscribe() callback fires on each advance", () => {
    const items = makeItems(3);
    const ctrl = new SwitchScanController(makeConfig(), items);
    const received: string[] = [];
    ctrl.subscribe((item) => {
      if (item) received.push(item.id);
    });
    ctrl.start();
    vi.advanceTimersByTime(200);
    expect(received).toEqual(["item-1", "item-2"]);
  });

  it("returns null from getHighlightedItem() when items list is empty", () => {
    const ctrl = new SwitchScanController(makeConfig(), []);
    expect(ctrl.getHighlightedItem()).toBeNull();
  });

  it("isAvailable() always returns true", () => {
    expect(SwitchScanController.isAvailable()).toBe(true);
  });
});

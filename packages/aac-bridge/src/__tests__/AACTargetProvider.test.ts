/**
 * AACTargetProvider — controller-level integration test (Sprint 7).
 *
 * The provider's React-level behaviour is exercised in apps/web-v2 via
 * the lesson-player smoke spec; here we test the SwitchScanController
 * contract the provider builds on, against the same SymbolItem shape
 * the provider generates from each registered target. That shape MUST
 * preserve registration order so the scanner walks targets in DOM
 * order — regressing it breaks AAC users mid-lesson.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SwitchScanController } from "../SwitchScanController.js";
import type { AACSessionConfig, SymbolItem } from "../types.js";

const baseConfig: AACSessionConfig = {
  method: "switch_1",
  scanDelayMs: 100,
  dwellTimeMs: 800,
  auditoryFeedback: false,
  highlightStyle: "box",
  autoStart: true,
};

/** Mirrors the synthetic SymbolItem the provider builds for each
 *  registered target. Keep in sync with `AACTargetProvider.orderedSymbols`. */
function targetToSymbol(id: string, label: string, order: number): SymbolItem {
  return { id, label, imageUrl: "", boardId: "aivo-ui-targets", position: { row: 0, col: order } };
}

describe("AAC target → SwitchScanController integration", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("scans registered targets in registration order", () => {
    const targets: SymbolItem[] = [
      targetToSymbol("submit", "Submit", 0),
      targetToSymbol("hint", "Hint", 1),
      targetToSymbol("next", "Next", 2),
    ];
    const ctrl = new SwitchScanController(baseConfig, targets);
    ctrl.start();
    expect(ctrl.getHighlightedItem()?.id).toBe("submit");
    vi.advanceTimersByTime(100);
    expect(ctrl.getHighlightedItem()?.id).toBe("hint");
    vi.advanceTimersByTime(100);
    expect(ctrl.getHighlightedItem()?.id).toBe("next");
    vi.advanceTimersByTime(100);
    // Wraps back to first target (1-switch users complete the lesson by
    // letting the scanner cycle to the desired target).
    expect(ctrl.getHighlightedItem()?.id).toBe("submit");
    ctrl.stop();
  });

  it("activate() returns an AACEvent referencing the highlighted target", () => {
    const targets: SymbolItem[] = [
      targetToSymbol("a", "Choice A", 0),
      targetToSymbol("b", "Choice B", 1),
    ];
    const ctrl = new SwitchScanController(baseConfig, targets);
    ctrl.start();
    vi.advanceTimersByTime(100); // advance to "b"
    const evt = ctrl.activate();
    expect(evt.method).toBe("switch_1");
    expect(evt.targetId).toBe("b");
    expect(evt.scanStep).toBe(1);
    expect(evt.timestamp).toBeGreaterThan(0);
  });

  it("activating a 2-switch session reports method=switch_2", () => {
    const ctrl = new SwitchScanController({ ...baseConfig, method: "switch_2" }, [
      targetToSymbol("x", "X", 0),
    ]);
    expect(ctrl.activate().method).toBe("switch_2");
  });

  it("notifies subscribers on every advance — the provider uses this to focus the highlighted element", () => {
    const targets: SymbolItem[] = [
      targetToSymbol("one", "One", 0),
      targetToSymbol("two", "Two", 1),
    ];
    const seen: Array<string | null> = [];
    const ctrl = new SwitchScanController(baseConfig, targets);
    ctrl.subscribe((item) => seen.push(item?.id ?? null));
    ctrl.start();
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);
    expect(seen).toEqual(["two", "one"]);
    ctrl.stop();
  });
});

describe("step-scan (two-switch) — autoScan=false maps to autoStart=false", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not auto-advance when autoStart is false (the provider's step-scan path)", () => {
    // The provider builds `autoStart: autoScan`, so a `switch_2` step-scan
    // session passes autoStart=false. The highlight must NOT drift on the
    // timer — it only moves when the learner presses the advance switch.
    const targets: SymbolItem[] = [
      targetToSymbol("skip", "Skip", 0),
      targetToSymbol("a", "Choice A", 1),
      targetToSymbol("b", "Choice B", 2),
    ];
    const ctrl = new SwitchScanController({ ...baseConfig, autoStart: false }, targets);
    ctrl.start();
    expect(ctrl.getHighlightedItem()?.id).toBe("skip");
    // Time passes — nothing moves without a switch press.
    vi.advanceTimersByTime(1000);
    expect(ctrl.getHighlightedItem()?.id).toBe("skip");
    // Advance switch (mapped to ArrowRight via AACScanRoot → ctx.advance()).
    ctrl.advance();
    expect(ctrl.getHighlightedItem()?.id).toBe("a");
    ctrl.advance();
    expect(ctrl.getHighlightedItem()?.id).toBe("b");
    // Wraps so the cycle never dead-ends — Skip is always reachable again.
    ctrl.advance();
    expect(ctrl.getHighlightedItem()?.id).toBe("skip");
    ctrl.stop();
  });

  it("Skip target is included in the scan cycle (no-fail: skipping is never harder than answering)", () => {
    // The runner registers Skip as the FIRST target so a switch user reaches
    // it before any answer — skipping must never cost more presses.
    const targets: SymbolItem[] = [
      targetToSymbol("skip", "Skip", 0),
      targetToSymbol("a", "Choice A", 1),
    ];
    const ctrl = new SwitchScanController({ ...baseConfig, autoStart: false }, targets);
    ctrl.start();
    // First highlight is Skip — one press of "select" skips the question.
    expect(ctrl.getHighlightedItem()?.id).toBe("skip");
    const evt = ctrl.activate();
    expect(evt.targetId).toBe("skip");
  });
});

describe("AACTargetProvider exports", () => {
  it("re-exports the React hooks + provider symbols", async () => {
    const mod = await import("../index.js");
    expect(typeof mod.AACTargetProvider).toBe("function");
    expect(typeof mod.AACScanRoot).toBe("function");
    expect(typeof mod.useAACTarget).toBe("function");
    expect(typeof mod.useAACContext).toBe("function");
  });
});

/**
 * Pinned contract for the switch-scan target registry (Sprint A4): the
 * overlay scans REAL registered actions in visual order, registrations
 * clean up on unmount, and activation reaches the owning handler. This is
 * the mechanism that turned SwitchScanOverlay from a dead `items={[]}`
 * mount into a working AAC surface.
 */
import { describe, expect, it, vi } from "vitest";
import { createScanTargetStore, type ScanTarget } from "../src/components/switch-scan/scan-target-store";

function target(id: string, order: number, onActivate: () => void = () => {}): ScanTarget {
  return { id, label: id, order, onActivate, measure: async () => null };
}

describe("scan-target store", () => {
  it("orders targets by `order`, breaking ties by registration sequence", () => {
    const store = createScanTargetStore();
    store.register(target("c", 30));
    store.register(target("a", 10));
    store.register(target("b2", 20));
    store.register(target("b1", 20));
    expect(store.getTargets().map((t) => t.id)).toEqual(["a", "b2", "b1", "c"]);
  });

  it("removes a target when its unregister handle runs (screen unmount)", () => {
    const store = createScanTargetStore();
    const off = store.register(target("gone", 10));
    store.register(target("stays", 20));
    off();
    expect(store.getTargets().map((t) => t.id)).toEqual(["stays"]);
  });

  it("re-registering the same id replaces the target (label/order updates)", () => {
    const store = createScanTargetStore();
    store.register(target("x", 10));
    store.register({ ...target("x", 99), label: "renamed" });
    expect(store.getTargets()).toHaveLength(1);
    expect(store.getTargets()[0]).toMatchObject({ label: "renamed", order: 99 });
  });

  it("notifies subscribers on register and unregister, and stops after unsubscribe", () => {
    const store = createScanTargetStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const off = store.register(target("a", 1));
    off();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.register(target("b", 2));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("activation reaches the registered handler", () => {
    const store = createScanTargetStore();
    const onActivate = vi.fn();
    store.register(target("answer-1", 10, onActivate));
    store.getTargets().find((t) => t.id === "answer-1")!.onActivate();
    expect(onActivate).toHaveBeenCalledTimes(1);
  });
});

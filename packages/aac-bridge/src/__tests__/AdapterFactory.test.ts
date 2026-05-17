import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectAndCreateAdapter, listAvailableAdapters } from "../adapters/AdapterFactory.js";
import { TobiiAdapter } from "../adapters/TobiiAdapter.js";
import { AssistiveWareAdapter } from "../adapters/AssistiveWareAdapter.js";
import type { AACSessionConfig } from "../types.js";

const makeConfig = (method: AACSessionConfig["method"]): AACSessionConfig => ({
  method,
  scanDelayMs: 1000,
  dwellTimeMs: 800,
  auditoryFeedback: false,
  highlightStyle: "box",
  autoStart: false,
});

describe("AdapterFactory — detectAndCreateAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("selects TobiiAdapter when method is eye_gaze and Tobii isAvailable", () => {
    vi.spyOn(TobiiAdapter.prototype, "isAvailable").mockReturnValue(true);
    const adapter = detectAndCreateAdapter(makeConfig("eye_gaze"));
    expect(adapter.vendorName).toBe("Tobii");
  });

  it("selects SwitchScanController when method is switch_1", () => {
    const adapter = detectAndCreateAdapter(makeConfig("switch_1"));
    expect(adapter.vendorName).toBe("SwitchScanController");
  });

  it("selects SwitchScanController when method is switch_2", () => {
    const adapter = detectAndCreateAdapter(makeConfig("switch_2"));
    expect(adapter.vendorName).toBe("SwitchScanController");
  });

  it("falls back to SwitchScanController when no vendor adapter is available", () => {
    vi.spyOn(TobiiAdapter.prototype, "isAvailable").mockReturnValue(false);
    vi.spyOn(AssistiveWareAdapter.prototype, "isAvailable").mockReturnValue(false);
    // PRCSaltilloAdapter.isAvailable checks window.__LAMP_SDK — not present in Node.
    const adapter = detectAndCreateAdapter(makeConfig("touch"));
    expect(adapter.vendorName).toBe("SwitchScanController");
  });
});

describe("AdapterFactory — listAvailableAdapters", () => {
  it("always includes SwitchScanController", () => {
    const adapters = listAvailableAdapters();
    expect(adapters).toContain("SwitchScanController");
  });

  it("returns an array of strings", () => {
    const adapters = listAvailableAdapters();
    for (const a of adapters) {
      expect(typeof a).toBe("string");
    }
  });
});

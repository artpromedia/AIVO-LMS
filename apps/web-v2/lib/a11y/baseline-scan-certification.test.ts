/**
 * Sprint C-15 — the baseline scanning surface, verified against the
 * aac-bridge vendor-certification suite.
 *
 * SCOPE NOTE (documented per the sprint DoD): the vendor-certification suite
 * (`runConformanceSuite` / `CONFORMANCE_CHECKS` in `@aivo/aac-bridge`)
 * certifies AAC *input adapters* — objects implementing `AACInputAdapter`
 * (`vendorName`, `isAvailable`, `initialize`, `onEvent`, `highlight`,
 * `dispose`). It does NOT inspect a DOM surface. The report framed it as
 * certifying "surfaces"; in reality it certifies the input layer.
 *
 * The baseline's switch scanning is driven by exactly that input layer: the
 * runner mounts `AACTargetProvider`, which wraps the package's single-source
 * `SwitchScanController`; the public `detectAndCreateAdapter()` returns the
 * same controller wrapped as a conforming `AACInputAdapter` for switch
 * methods. So "the baseline verified with the vendor-certification suite"
 * means: the adapter the baseline scanning rests on PASSES the suite, with the
 * baseline's own resolved session config (input method + conservative dwell).
 *
 * What the e2e covers BEYOND the certification suite (the surface concerns the
 * suite cannot see): DOM-order scan traversal over the runner's operable
 * elements, Skip-in-cycle, the read-aloud pairing, break/Stop-for-today
 * reachability, and a full intro→completion run with zero pointer events —
 * see `e2e/baseline-switch-scan.playwright.ts` and the jsdom interaction test
 * in `baseline-scan-runner.test.tsx`.
 */
import { describe, it, expect } from "vitest";
import {
  detectAndCreateAdapter,
  runConformanceSuite,
  CONFORMANCE_CHECKS,
  SUITE_VERSION,
  type AACSessionConfig,
} from "@aivo/aac-bridge";
import { resolveBaselineScanConfig } from "./baseline-scan";

/** Build the AAC session config the way the baseline runner would for a given
 *  input method, reusing the runner's own dwell resolution. */
function baselineSessionConfig(inputMethod: "switch_1" | "switch_2"): AACSessionConfig {
  const scan = resolveBaselineScanConfig({
    aacEnabled: true,
    aacInputMethod: inputMethod,
    // Use the contract default so the runner applies its conservative floor.
    aacScanDelayMs: 1200,
  });
  return {
    method: scan.inputMethod as "switch_1" | "switch_2",
    scanDelayMs: scan.scanDelayMs,
    dwellTimeMs: 800,
    auditoryFeedback: false,
    highlightStyle: "box",
    // The conformance suite calls initialize()/dispose() directly; autoStart
    // is irrelevant to the checks but we model the runner's choice.
    autoStart: scan.autoScan,
  };
}

describe("baseline switch adapter — vendor-certification suite", () => {
  it("the single-switch (auto-scan) adapter passes every conformance check", async () => {
    const cfg = baselineSessionConfig("switch_1");
    const adapter = detectAndCreateAdapter(cfg, []);
    const result = await runConformanceSuite(adapter, cfg);
    const failed = result.checks.filter((c) => !c.passed);
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.suiteVersion).toBe(SUITE_VERSION);
    // The baseline's switch path resolves to the software SwitchScanController
    // adapter (always available — no vendor SDK required to take the baseline).
    expect(result.vendor).toBe("SwitchScanController");
  });

  it("the two-switch (step-scan) adapter passes every conformance check", async () => {
    const cfg = baselineSessionConfig("switch_2");
    const adapter = detectAndCreateAdapter(cfg, []);
    const result = await runConformanceSuite(adapter, cfg);
    const failed = result.checks.filter((c) => !c.passed);
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it("runs the full canonical check set (no checks silently skipped)", async () => {
    const cfg = baselineSessionConfig("switch_1");
    const adapter = detectAndCreateAdapter(cfg, []);
    const result = await runConformanceSuite(adapter, cfg);
    // Every canonical check is represented in the result.
    expect(result.checks.map((c) => c.id).sort()).toEqual(
      CONFORMANCE_CHECKS.map((c) => c.id).sort(),
    );
  });
});

/**
 * Vendor-certification harness tests — runs the conformance suite against
 * each shipped adapter and asserts the certified-vendor registry stays
 * consistent with the suite's verdict.
 */
import { describe, it, expect } from "vitest";
import {
  runConformanceSuite,
  CONFORMANCE_CHECKS,
  SUITE_VERSION,
  isCertified,
  CERTIFIED_VENDORS,
  certificationsFor,
} from "../index.js";
import { PRCSaltilloAdapter } from "../adapters/PRCSaltilloAdapter.js";
import { TobiiAdapter } from "../adapters/TobiiAdapter.js";
import { AssistiveWareAdapter } from "../adapters/AssistiveWareAdapter.js";

describe("conformance suite", () => {
  it("PRCSaltilloAdapter passes every check", async () => {
    const r = await runConformanceSuite(new PRCSaltilloAdapter());
    const failed = r.checks.filter((c) => !c.passed);
    expect(failed, JSON.stringify(failed)).toEqual([]);
    expect(r.passed).toBe(true);
    expect(r.suiteVersion).toBe(SUITE_VERSION);
  });

  it("TobiiAdapter passes every check", async () => {
    const r = await runConformanceSuite(new TobiiAdapter());
    const failed = r.checks.filter((c) => !c.passed);
    expect(failed, JSON.stringify(failed)).toEqual([]);
  });

  it("AssistiveWareAdapter passes every check", async () => {
    const r = await runConformanceSuite(new AssistiveWareAdapter());
    const failed = r.checks.filter((c) => !c.passed);
    expect(failed, JSON.stringify(failed)).toEqual([]);
  });

  it("an adapter missing required fields fails the right checks", async () => {
    const broken = {
      vendorName: "",
      isAvailable: () => "no" as unknown as boolean,
      initialize: async () => {},
      onEvent: () => undefined as unknown as () => void,
      dispose: () => {},
      highlight: () => {},
    };
    const r = await runConformanceSuite(broken as Parameters<typeof runConformanceSuite>[0]);
    expect(r.passed).toBe(false);
    const failedIds = r.checks.filter((c) => !c.passed).map((c) => c.id);
    expect(failedIds).toContain("vendor-name");
    expect(failedIds).toContain("is-available");
    expect(failedIds).toContain("on-event-returns-disposer");
  });

  it("CONFORMANCE_CHECKS has unique stable ids", () => {
    const ids = CONFORMANCE_CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("certified-vendor registry", () => {
  it("isCertified() agrees with the registry", () => {
    expect(isCertified("PRC-Saltillo")).toBe(true);
    expect(isCertified("Tobii")).toBe(true);
    expect(isCertified("AssistiveWare")).toBe(true);
    expect(isCertified("Unknown-Vendor")).toBe(false);
  });
  it("certificationsFor returns newest-first records", () => {
    const tobiiCerts = certificationsFor("Tobii");
    expect(tobiiCerts.length).toBeGreaterThan(0);
    expect(tobiiCerts[0].adapterId).toBe("Tobii");
  });
  it("every registry entry references the current suite version", () => {
    for (const v of CERTIFIED_VENDORS) {
      expect(v.suiteVersion).toBe(SUITE_VERSION);
    }
  });
});

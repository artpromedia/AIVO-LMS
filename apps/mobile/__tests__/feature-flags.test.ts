/**
 * Sprint 10 — mobile feature-flags smoke test.
 *
 * Pins the boolean env parser + the default-off behaviour of the
 * MOBILE_UNIFIED_APP migration flag. Regressing the default would
 * accidentally ship the unified shell to learners while the legacy
 * role-group shells are still the contract — exactly the bug the flag
 * exists to prevent.
 */
import { describe, it, expect } from "vitest";
import { MOBILE_FLAGS, isFlagOn } from "../lib/feature-flags";

describe("mobile feature flags", () => {
  it("exposes MOBILE_UNIFIED_APP as a boolean", () => {
    expect(typeof MOBILE_FLAGS.MOBILE_UNIFIED_APP).toBe("boolean");
  });

  it("defaults MOBILE_UNIFIED_APP to false (legacy shell still ships)", () => {
    // The flag's default is hardcoded; this test catches an accidental
    // flip during the migration window.
    expect(MOBILE_FLAGS.MOBILE_UNIFIED_APP).toBe(false);
  });

  it("isFlagOn round-trips the flag value", () => {
    expect(isFlagOn("MOBILE_UNIFIED_APP")).toBe(MOBILE_FLAGS.MOBILE_UNIFIED_APP);
  });
});

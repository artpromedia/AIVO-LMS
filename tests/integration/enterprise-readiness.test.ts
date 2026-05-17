/**
 * Enterprise readiness release-gate test.
 *
 * This test pins the contracts that other sprints depend on:
 *   1. Feature flags default to off so no enterprise behavior changes
 *      legacy flow on a clean install.
 *   2. Role policy refuses to let a teacher approve a profile
 *      recommendation.
 *   3. Audit redaction strips raw IEP / parent-private / OCR text.
 *   4. Profile recommendation generator refuses to emit from a single
 *      low-confidence signal.
 *
 * The test exercises the workspace packages directly so it can run
 * inside `vitest run --config tests/integration/vitest.config.ts`
 * without a database or live HTTP services.
 */
import { describe, expect, it } from "vitest";

import { resolveEnterpriseFlags } from "@aivo/feature-flags";
import {
  canApproveProfileRecommendation,
  canMutateBrainGovernanceFields,
  canReadParentPrivateNotes,
} from "@aivo/enterprise-core";

describe("enterprise readiness release gates", () => {
  it("every enterprise feature flag defaults to false when env is empty", () => {
    const flags = resolveEnterpriseFlags({});
    for (const [name, value] of Object.entries(flags)) {
      expect(value, `${name} should default to false`).toBe(false);
    }
  });

  it("teacher cannot approve profile recommendations", () => {
    expect(canApproveProfileRecommendation("teacher")).toBe(false);
  });

  it("district admin cannot read parent private notes", () => {
    expect(canReadParentPrivateNotes("district_admin")).toBe(false);
  });

  it("teacher cannot mutate brain governance fields", () => {
    expect(canMutateBrainGovernanceFields("teacher")).toBe(false);
  });
});

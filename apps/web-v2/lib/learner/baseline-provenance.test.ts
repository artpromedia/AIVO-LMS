/**
 * Wave A (G2) — the provenance badge mapping must never overclaim:
 * cohort bank picks may not present as child-specific personalization,
 * and legacy rows without the new field degrade to the defensible state.
 */
import { describe, expect, it } from "vitest";
import { baselineProvenance } from "@/lib/learner/baseline-provenance";
import type { BaselineGenerationMetadata } from "@/lib/db/types";

const NOW = "2026-06-11T00:00:00.000Z";

function meta(partial: Partial<BaselineGenerationMetadata>): BaselineGenerationMetadata {
  return { source: "ai", generatedAt: NOW, ...partial };
}

describe("baselineProvenance", () => {
  it("maps the explicit personalization field 1:1", () => {
    expect(baselineProvenance(meta({ personalization: "child_specific" })).i18nKey).toBe(
      "provenance_child_specific",
    );
    expect(baselineProvenance(meta({ personalization: "cohort_bank" })).i18nKey).toBe(
      "provenance_cohort_bank",
    );
    expect(
      baselineProvenance(meta({ source: "fallback", personalization: "generic" })).i18nKey,
    ).toBe("provenance_generic");
  });

  it("classifies legacy bank rows (model bank/*) as cohort_bank, not child-specific", () => {
    const p = baselineProvenance(meta({ model: "bank/claude-sonnet-4-6" }));
    expect(p.personalization).toBe("cohort_bank");
    expect(p.tone).toBe("primary");
  });

  it("classifies legacy live-LLM rows (non-bank model) as child_specific", () => {
    expect(baselineProvenance(meta({ model: "claude-opus-4-8" })).personalization).toBe(
      "child_specific",
    );
    expect(baselineProvenance(meta({ model: "discovery-adventure" })).personalization).toBe(
      "child_specific",
    );
  });

  it("never overclaims on ambiguous legacy rows", () => {
    // source "ai" with no model recorded → cohort_bank (defensible floor).
    expect(baselineProvenance(meta({})).personalization).toBe("cohort_bank");
    // fallback rows and missing metadata → generic.
    expect(baselineProvenance(meta({ source: "fallback" })).personalization).toBe("generic");
    expect(baselineProvenance(undefined).personalization).toBe("generic");
    expect(baselineProvenance(null).personalization).toBe("generic");
  });
});

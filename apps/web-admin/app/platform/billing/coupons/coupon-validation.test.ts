import { describe, expect, it } from "vitest";
import { type CouponDraft, COUPON_PRESETS, validateCouponDraft } from "./coupon-validation";

const base: CouponDraft = { code: "PILOT-2026", couponType: "DISCOUNT", discountPct: 25 };

describe("validateCouponDraft", () => {
  it("accepts a valid DISCOUNT draft", () => {
    expect(validateCouponDraft(base)).toEqual([]);
  });

  it("rejects a malformed code", () => {
    expect(validateCouponDraft({ ...base, code: "x" }).length).toBeGreaterThan(0);
    expect(validateCouponDraft({ ...base, code: "lower case!" }).length).toBeGreaterThan(0);
  });

  it("rejects an out-of-range discount", () => {
    expect(validateCouponDraft({ ...base, discountPct: 0 }).length).toBeGreaterThan(0);
    expect(validateCouponDraft({ ...base, discountPct: 101 }).length).toBeGreaterThan(0);
    expect(validateCouponDraft({ ...base, discountPct: null }).length).toBeGreaterThan(0);
  });

  it("requires a duration for SUBSCRIPTION", () => {
    expect(
      validateCouponDraft({ code: "SUB", couponType: "SUBSCRIPTION", grantsDurationDays: null })
        .length,
    ).toBeGreaterThan(0);
    expect(
      validateCouponDraft({ code: "SUB", couponType: "SUBSCRIPTION", grantsDurationDays: 30 }),
    ).toEqual([]);
  });

  it("requires tier + plan + duration for PROVISIONING", () => {
    const missing = validateCouponDraft({ code: "PROV", couponType: "PROVISIONING" });
    expect(missing.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects a duration above 3650 days", () => {
    expect(
      validateCouponDraft({ code: "SUB", couponType: "SUBSCRIPTION", grantsDurationDays: 4000 })
        .length,
    ).toBeGreaterThan(0);
  });
});

describe("COUPON_PRESETS", () => {
  it("ships a district pilot and a school pilot", () => {
    const ids = COUPON_PRESETS.map((p) => p.id);
    expect(ids).toContain("district-pilot");
    expect(ids).toContain("school-pilot");
  });

  it("each preset yields a valid PROVISIONING draft once a code is set", () => {
    for (const preset of COUPON_PRESETS) {
      const draft = { code: "PILOT-CODE", ...preset.draft } as CouponDraft;
      expect(draft.couponType).toBe("PROVISIONING");
      expect(validateCouponDraft(draft), preset.id).toEqual([]);
    }
  });
});

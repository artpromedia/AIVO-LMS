import { describe, expect, it } from "vitest";
import { pickCheckoutAttribution, readCheckoutAttribution } from "./checkout-attribution";

describe("pickCheckoutAttribution", () => {
  it("reads camelCase and snake_case + the coupon alias", () => {
    expect(
      pickCheckoutAttribution({
        couponCode: "DISTRICT-PILOT",
        utm_source: "newsletter",
        utmMedium: "email",
        utm_campaign: "spring",
      }),
    ).toEqual({
      couponCode: "DISTRICT-PILOT",
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "spring",
    });
  });

  it("accepts ?coupon= and trims blanks", () => {
    expect(pickCheckoutAttribution({ coupon: " SCHOOL-PILOT ", utm_source: "" })).toEqual({
      couponCode: "SCHOOL-PILOT",
    });
  });

  it("returns {} when nothing is present or input is nullish", () => {
    expect(pickCheckoutAttribution({})).toEqual({});
    expect(pickCheckoutAttribution(null)).toEqual({});
    expect(pickCheckoutAttribution(undefined)).toEqual({});
  });
});

describe("readCheckoutAttribution (SSR-safe)", () => {
  it("returns {} when there is no window", () => {
    expect(readCheckoutAttribution()).toEqual({});
  });
});

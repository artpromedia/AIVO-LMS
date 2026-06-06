/**
 * Subscription attribution helper — pure, no DB.
 */
import { test } from "node:test";
import assert from "node:assert";
import { pickAttribution } from "../src/lib/attribution.js";

test("picks camelCase and snake_case utm + coupon", () => {
  assert.deepEqual(
    pickAttribution({
      couponCode: "DISTRICT-PILOT",
      utmSource: "newsletter",
      utm_medium: "email",
      utm_campaign: "spring-pilots",
    }),
    {
      couponCode: "DISTRICT-PILOT",
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "spring-pilots",
    },
  );
});

test("accepts the ?coupon= alias and trims blanks", () => {
  assert.deepEqual(pickAttribution({ coupon: " SCHOOL-PILOT ", utm_source: "" }), {
    couponCode: "SCHOOL-PILOT",
  });
});

test("returns an empty object when nothing is present", () => {
  assert.deepEqual(pickAttribution({}), {});
  assert.deepEqual(pickAttribution(null), {});
  assert.deepEqual(pickAttribution(undefined), {});
});

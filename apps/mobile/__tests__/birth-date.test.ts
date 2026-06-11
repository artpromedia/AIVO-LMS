/** COPPA age-gate validator contract (Sprint A6). */
import { describe, expect, it } from "vitest";
import { validateBirthDate, isUnder13 } from "../lib/birth-date";

describe("validateBirthDate", () => {
  it("accepts a real past date in range", () => {
    expect(validateBirthDate("2017-09-01")).toBeNull();
  });
  it("rejects bad shapes and impossible dates", () => {
    expect(validateBirthDate("09/01/2017")).toBe("format");
    expect(validateBirthDate("2017-13-40")).toBe("invalid");
    expect(validateBirthDate("2017-02-30")).toBe("invalid");
  });
  it("rejects future dates and implausible ages", () => {
    expect(validateBirthDate("2199-01-01")).toBe("future");
    expect(validateBirthDate("1990-01-01")).toBe("tooOld");
  });
});

describe("isUnder13", () => {
  const now = new Date("2026-06-11T00:00:00Z");
  it("is true under the boundary and false at/over it", () => {
    expect(isUnder13("2015-06-12", now)).toBe(true);   // turns 13 tomorrow
    expect(isUnder13("2013-06-10", now)).toBe(false);  // already 13
  });
  it("fails closed on garbage", () => {
    expect(isUnder13("not-a-date", now)).toBe(true);
  });
});

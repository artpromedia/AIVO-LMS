import { describe, expect, it } from "vitest";
import { resolveTimeZone, isValidTimeZone } from "./timezone";

describe("resolveTimeZone (Sprint A8)", () => {
  it("prefers the user's zone, then tenant, then UTC", () => {
    expect(resolveTimeZone("Asia/Tokyo", "Europe/Paris")).toBe("Asia/Tokyo");
    expect(resolveTimeZone(null, "Europe/Paris")).toBe("Europe/Paris");
    expect(resolveTimeZone(null, null)).toBe("UTC");
  });
  it("rejects garbage zones instead of crashing the formatter", () => {
    expect(resolveTimeZone("Not/AZone")).toBe("UTC");
    expect(resolveTimeZone("")).toBe("UTC");
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("x".repeat(80))).toBe(false);
  });
});

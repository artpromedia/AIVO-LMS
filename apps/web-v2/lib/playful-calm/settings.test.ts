import { describe, expect, it } from "vitest";
import { resolvePlayfulAgeMode, resolvePlayfulTheme } from "./settings";

describe("Playful Calm settings resolvers", () => {
  it("resolves supported themes and defaults invalid values", () => {
    expect(resolvePlayfulTheme("dark")).toBe("dark");
    expect(resolvePlayfulTheme("high-contrast")).toBe("high-contrast");
    expect(resolvePlayfulTheme("unknown")).toBe("light");
  });

  it("resolves supported age modes and defaults invalid values", () => {
    expect(resolvePlayfulAgeMode("sprout")).toBe("sprout");
    expect(resolvePlayfulAgeMode("scholar")).toBe("scholar");
    expect(resolvePlayfulAgeMode("invalid")).toBe("spark");
  });
});

import { describe, it, expect } from "vitest";
import { generateSuggestions, isFieldType } from "./suggestions";

describe("generateSuggestions", () => {
  it("returns chip suggestions for a known field", () => {
    const { suggestions } = generateSuggestions("learner_strengths", "");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(6);
  });

  it("filters out entries already in the textarea (case-insensitive)", () => {
    const { suggestions } = generateSuggestions(
      "learner_strengths",
      "loves animals\nGreat at Puzzles",
    );
    const lower = suggestions.map((s) => s.toLowerCase());
    expect(lower).not.toContain("loves animals");
    expect(lower).not.toContain("great at puzzles");
  });

  it("filters out entries listed in existingItems", () => {
    const { suggestions } = generateSuggestions("learner_strengths", "", {
      existingItems: ["Loves animals"],
    });
    expect(suggestions.map((s) => s.toLowerCase())).not.toContain("loves animals");
  });

  it("offers ghost-text completion for a partial token", () => {
    const { completion } = generateSuggestions("learner_strengths", "Loves an");
    // Should complete "Loves an" → "imals" (from "Loves animals").
    expect(completion).not.toBeNull();
    expect("Loves an" + (completion ?? "")).toBe("Loves animals");
  });

  it("returns no completion for empty text or 1-char fragment", () => {
    expect(generateSuggestions("learner_strengths", "").completion).toBeNull();
    expect(generateSuggestions("learner_strengths", "L").completion).toBeNull();
  });

  it("biases by age band when provided", () => {
    const { suggestions } = generateSuggestions("learner_loves", "", {
      ageRange: "3-5",
    });
    // The pre-K bias list includes "Caring for pets" — should surface early.
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.slice(0, 3)).toEqual(expect.arrayContaining(["Caring for pets"]));
  });

  it("respects the limit parameter", () => {
    const { suggestions } = generateSuggestions("learner_strengths", "", {}, 3);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  it("returns an empty result for an unknown field type", () => {
    const { suggestions } = generateSuggestions("not_a_field" as never, "");
    expect(suggestions).toEqual([]);
  });
});

describe("isFieldType", () => {
  it("accepts allowed values", () => {
    expect(isFieldType("learner_strengths")).toBe(true);
    expect(isFieldType("frustration_triggers")).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isFieldType("nope")).toBe(false);
    expect(isFieldType(123)).toBe(false);
    expect(isFieldType(null)).toBe(false);
  });
});

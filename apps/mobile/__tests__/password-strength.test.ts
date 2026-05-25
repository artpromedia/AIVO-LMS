/**
 * Sprint 10 — mobile pure-logic smoke test.
 *
 * Pins `estimatePasswordStrength` so the client-side affordance on the
 * forced-change-password and email-link reset screens stays in lockstep
 * with the server policy in identity-svc/evaluatePassword.
 */
import { describe, it, expect } from "vitest";
import { estimatePasswordStrength } from "../lib/passwordStrength";

describe("estimatePasswordStrength", () => {
  it("returns score 0 for an empty password", () => {
    expect(estimatePasswordStrength("")).toEqual({ score: 0, reasons: [] });
  });

  it("scores within 0..4 for any non-empty input", () => {
    for (const pwd of ["a", "abcd", "Abcd1", "Abcd1!", "VeryStrong-Pass-2026!"]) {
      const { score } = estimatePasswordStrength(pwd);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(4);
    }
  });

  it("rewards a long mixed-class password over a short one", () => {
    const weak = estimatePasswordStrength("abc");
    const strong = estimatePasswordStrength("VeryStrong-Pass-2026!");
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it("penalises repeated characters versus diverse ones", () => {
    const repeated = estimatePasswordStrength("aaaaaaaaaaaa");
    const diverse = estimatePasswordStrength("Abcde-Fghi-2026!");
    expect(diverse.score).toBeGreaterThan(repeated.score);
  });

  it("never exceeds the score window even for absurdly long inputs", () => {
    const huge = estimatePasswordStrength("Z".repeat(500) + "!9abc");
    expect(huge.score).toBeLessThanOrEqual(4);
  });
});

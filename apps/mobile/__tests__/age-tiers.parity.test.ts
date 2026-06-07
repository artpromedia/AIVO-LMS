/**
 * Cross-platform parity test for the age-tier mapping.
 *
 * The web (`@aivo/learner-ui`) and mobile (`@aivo/mobile-ui`) packages
 * each ship their own `gradeToTier` because the web version's React DOM
 * deps can't be loaded into the React Native bundler. This test locks
 * both implementations to a single expectation table — if either drifts,
 * the test breaks and we have to fix the divergence intentionally.
 *
 * Both implementations are imported directly from their (pure-TS,
 * dependency-free) source modules. `@aivo/learner-ui` is not a mobile
 * dependency, so the web `age-tiers` module is wired in through a
 * test-only Vite alias (see `vitest.config.ts`) rather than installing
 * the whole web package — that keeps React-DOM/CSS helpers out of the
 * RN graph while still running the parity assertions for real.
 */
import { describe, expect, it } from "vitest";
// Deep import: pulling from "@aivo/mobile-ui" would transitively pull
// the RN component bundle (AivoButton/Card/etc.), which vitest's
// rollup-based parser chokes on. The age-tier helpers are pure TS and
// safe to import directly.
import { gradeToTier as gradeToTierMobile } from "@aivo/mobile-ui/src/tierTheme";
// Web counterpart imported directly because learner-ui is intentionally not
// a runtime dependency of the React Native application.
import { gradeToTier as gradeToTierWeb } from "../../../packages/learner-ui/src/tokens/age-tiers";

interface Case {
  input: string | number | null | undefined;
  expected: "EARLY" | "MIDDLE" | "HIGH";
  note?: string;
}

// Canonical expectation table. Both implementations must agree on every row.
const CASES: Case[] = [
  { input: null, expected: "EARLY", note: "null → safest fallback" },
  { input: undefined, expected: "EARLY", note: "undefined → safest fallback" },
  { input: "", expected: "EARLY", note: "empty string → safest fallback" },
  { input: "PK", expected: "EARLY" },
  { input: "pre-k", expected: "EARLY" },
  { input: "prek", expected: "EARLY" },
  { input: "Pre-Kindergarten", expected: "EARLY" },
  { input: "K", expected: "EARLY" },
  { input: "kindergarten", expected: "EARLY" },
  { input: "Kinder", expected: "EARLY" },
  { input: "1", expected: "EARLY" },
  { input: "1st", expected: "EARLY" },
  { input: "5", expected: "EARLY" },
  { input: "5th grade", expected: "EARLY" },
  { input: 5, expected: "EARLY", note: "numeric input" },
  { input: "6", expected: "MIDDLE" },
  { input: "grade 7", expected: "MIDDLE" },
  { input: "8th", expected: "MIDDLE" },
  { input: 8, expected: "MIDDLE" },
  { input: "9", expected: "HIGH" },
  { input: "10th grade", expected: "HIGH" },
  { input: "12", expected: "HIGH" },
  { input: 12, expected: "HIGH" },
  { input: "13", expected: "HIGH", note: "out-of-band high → HIGH" },
  { input: "garbage", expected: "EARLY", note: "unparseable → fallback" },
  { input: "  6  ", expected: "MIDDLE", note: "whitespace tolerated" },
  { input: "GRADE 4", expected: "EARLY", note: "case-insensitive" },
];

describe("age-tier parity (mobile)", () => {
  for (const c of CASES) {
    it(`mobile gradeToTier(${JSON.stringify(c.input)}) → ${c.expected}${c.note ? ` (${c.note})` : ""}`, () => {
      expect(gradeToTierMobile(c.input)).toBe(c.expected);
    });
  }
});

describe("age-tier parity (web ↔ mobile)", () => {
  for (const c of CASES) {
    it(`web vs mobile agree on gradeToTier(${JSON.stringify(c.input)})`, () => {
      // Both must agree with each other *and* with the canonical table.
      expect(gradeToTierWeb(c.input)).toBe(gradeToTierMobile(c.input));
      expect(gradeToTierWeb(c.input)).toBe(c.expected);
    });
  }
});

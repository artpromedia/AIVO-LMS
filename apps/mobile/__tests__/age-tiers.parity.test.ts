/**
 * Cross-platform parity test for the age-tier mapping.
 *
 * The web (`@aivo/learner-ui`) and mobile (`@aivo/mobile-ui`) packages
 * each ship their own `gradeToTier` because the web version's React DOM
 * deps can't be loaded into the React Native bundler. This test locks
 * both implementations to a single expectation table — if either drifts,
 * the test breaks and we have to fix the divergence intentionally.
 *
 * The web `gradeToTier` is dynamically imported via require() under a
 * try/catch because the mobile vitest project doesn't have web build
 * artifacts wired up. When the web version isn't resolvable we still run
 * the mobile assertions so this test never silently passes — it logs
 * a clear message and only the parity half is skipped.
 */
import { describe, expect, it } from "vitest";
// Deep import: pulling from "@aivo/mobile-ui" would transitively pull
// the RN component bundle (AivoButton/Card/etc.), which vitest's
// rollup-based parser chokes on. The age-tier helpers are pure TS and
// safe to import directly.
import { gradeToTier as gradeToTierMobile } from "@aivo/mobile-ui/src/tierTheme";

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
  // Web package isn't part of the mobile vitest module graph by default;
  // we attempt a best-effort dynamic resolution so the parity check runs
  // whenever the workspace has been built, and we noisily skip otherwise
  // rather than silently passing.
  let webGradeToTier: ((g: unknown) => string) | null = null;
  try {
    // Use createRequire so vitest's rollup transform doesn't try to
    // statically analyse the web module graph (the web package pulls
    // in CSS-var-dependent helpers that don't parse cleanly here).
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- intentional dynamic resolution for parity test
    const { createRequire } = require("node:module");
    const req = createRequire(__filename);
    const mod = req("@aivo/learner-ui/src/tokens/age-tiers");
    webGradeToTier = (mod && mod.gradeToTier) || null;
  } catch {
    webGradeToTier = null;
  }

  for (const c of CASES) {
    const label = `web vs mobile agree on gradeToTier(${JSON.stringify(c.input)})`;
    if (!webGradeToTier) {
      it.skip(`${label} (web package not resolvable — parity check skipped)`, () => {});
      continue;
    }
    const fn = webGradeToTier;
    it(label, () => {
      expect(fn(c.input)).toBe(gradeToTierMobile(c.input));
    });
  }
});

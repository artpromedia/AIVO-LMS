/**
 * Pure mastery-distribution aggregation for classroom / caseload reports.
 * Buckets a set of learners' overall mastery into the bands web uses,
 * so teacher + therapist reports can show a class-wide distribution.
 * Brand-free + node-testable; mirror in __tests__/mastery-distribution.test.ts.
 */
import { masteryLevelFromScore, type MasteryLevel } from "../src/design/chart-scale";

export type Band = "stretching" | "onGrade" | "approaching" | "emerging";

export interface LearnerMastery {
  learnerId: string;
  /** Overall mastery in 0..1 or 0..100. */
  overall: number;
}

export interface Distribution {
  bands: Record<Band, number>;
  total: number;
  /** Class/caseload average in 0..100. */
  average: number;
}

const LEVEL_TO_BAND: Record<MasteryLevel, Band> = {
  mastered: "stretching",
  proficient: "onGrade",
  developing: "approaching",
  emerging: "emerging",
};

export const BAND_ORDER: Band[] = ["stretching", "onGrade", "approaching", "emerging"];

export const BAND_LABEL: Record<Band, string> = {
  stretching: "Stretching",
  onGrade: "On grade",
  approaching: "Approaching",
  emerging: "Emerging",
};

export const BAND_TONE: Record<Band, string> = {
  stretching: "#22c55e",
  onGrade: "#7c3aed",
  approaching: "#f59e0b",
  emerging: "#ef4444",
};

function pct(v: number): number {
  const n = v > 1 ? v / 100 : v;
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0)) * 100;
}

export function distribution(learners: ReadonlyArray<LearnerMastery>): Distribution {
  const bands: Record<Band, number> = { stretching: 0, onGrade: 0, approaching: 0, emerging: 0 };
  let sum = 0;
  for (const l of learners) {
    bands[LEVEL_TO_BAND[masteryLevelFromScore(l.overall)]] += 1;
    sum += pct(l.overall);
  }
  return {
    bands,
    total: learners.length,
    average: learners.length === 0 ? 0 : Math.round(sum / learners.length),
  };
}

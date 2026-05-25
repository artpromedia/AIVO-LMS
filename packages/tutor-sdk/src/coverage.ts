import type { GradeBand } from "@aivo/skill-graphs";
import type { TutorCoverageStatus, TutorDefinition } from "./types.js";

/**
 * Coverage-matrix helpers used by the runtime / catalog / CI gates.
 *
 * A grade band is "production-ready" if its `coverageMatrix` entry is
 * `"authored"`. `"scaffold"` and `"missing"` bands are non-production:
 * the runtime refuses to plan sessions for them unless the caller
 * explicitly opts into preview/scaffold mode.
 *
 * Tutors that omit `coverageMatrix` entirely are treated as
 * production-ready for every declared `gradeBand` — this preserves
 * backward compatibility with pre-`coverageMatrix` definitions, but new
 * tutors are expected to declare the matrix explicitly (see the
 * tutor-registry test in `services/tutor-svc/tests/tutor-registry.test.ts`).
 */

export function getCoverageStatus(
  def: TutorDefinition,
  band: GradeBand,
): TutorCoverageStatus | undefined {
  if (!def.coverageMatrix) return undefined;
  return def.coverageMatrix[band];
}

export function isBandProductionReady(def: TutorDefinition, band: GradeBand): boolean {
  if (!def.gradeBands.includes(band)) return false;
  if (!def.coverageMatrix) return true;
  return def.coverageMatrix[band] === "authored";
}

export function getProductionGradeBands(def: TutorDefinition): GradeBand[] {
  if (!def.coverageMatrix) return [...def.gradeBands];
  return def.gradeBands.filter((b) => def.coverageMatrix?.[b] === "authored");
}

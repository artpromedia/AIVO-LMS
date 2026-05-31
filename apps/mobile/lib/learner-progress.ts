/**
 * Pure aggregation for the learner progress + subjects screens.
 *
 * Turns the per-domain mastery the mobile app already has (from
 * brain-svc via `useBrainDomains`) into the summary shape the Progress
 * screen renders. Brand-free + side-effect-free so it is unit-testable
 * in the vitest node env; uses the app-side chart scale mirror.
 */
import { masteryLevelFromScore, type MasteryLevel } from "../src/design/chart-scale";

export interface DomainInput {
  /** Display name of the domain/subject (e.g. "Math"). */
  domain: string;
  /** Mastery as a percentage, 0..100. */
  masteryPercent: number;
}

export interface SubjectStat {
  name: string;
  /** 0..100. */
  mastery: number;
  level: MasteryLevel;
}

export interface ProgressSummary {
  /** Mean mastery across domains, 0..100 (0 when none). */
  overallMastery: number;
  /** Domains at the `mastered` level. */
  masteredCount: number;
  /** Domains at the `emerging` level (need support). */
  needsSupportCount: number;
  /** Domains in between (developing / proficient). */
  onTrackCount: number;
  /** Total domains tracked. */
  total: number;
  /** Per-subject stats, strongest first. */
  subjects: SubjectStat[];
}

export function summarizeDomains(domains: ReadonlyArray<DomainInput>): ProgressSummary {
  const subjects: SubjectStat[] = domains.map((d) => ({
    name: d.domain,
    mastery: clampPct(d.masteryPercent),
    level: masteryLevelFromScore(d.masteryPercent),
  }));

  const masteredCount = subjects.filter((s) => s.level === "mastered").length;
  const needsSupportCount = subjects.filter((s) => s.level === "emerging").length;
  const onTrackCount = subjects.length - masteredCount - needsSupportCount;
  const overallMastery =
    subjects.length === 0
      ? 0
      : Math.round(subjects.reduce((sum, s) => sum + s.mastery, 0) / subjects.length);

  const sorted = [...subjects].sort((a, b) => b.mastery - a.mastery);

  return {
    overallMastery,
    masteredCount,
    needsSupportCount,
    onTrackCount,
    total: subjects.length,
    subjects: sorted,
  };
}

function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

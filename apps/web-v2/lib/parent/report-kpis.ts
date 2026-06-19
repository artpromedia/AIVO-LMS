/**
 * Learner report KPIs — the single, truthful computation behind both the
 * parent home "IEP reports" card and the `/parent/reports` page.
 *
 * Every value is read from real repo data (mastery map, lesson runs, mastery
 * snapshots, IEP) — there are no fabricated numbers. Mirrors the formulas the
 * reports page has always used so the home card and the full report never
 * disagree.
 */
import {
  getIEPForLearner,
  getMasteryMap,
  listLessonRunsForLearner,
  listMasterySnapshots,
  listSubjects,
} from "@/lib/db/repos";
import { computeDeltaPct, splitIntoPeriods } from "@/lib/analytics/trend-compute";
import type { MasterySnapshot } from "@/lib/db/types";

export interface SubjectProgress {
  subjectId: string;
  subject: string;
  /** 0..100 mastery for the subject's most recent snapshot. */
  pct: number;
}

export interface LearnerReportKpis {
  /** 0..100 mean mastery across all tracked skills. */
  overallMasteryPct: number;
  /** Signed % change vs the prior 30 days, or null when there's no prior. */
  overallMasteryDeltaPct: number | null;
  completedCount: number;
  completedDeltaPct: number | null;
  skillsTracked: number;
  iepSupportsCount: number;
  iepActive: boolean;
  /** Up to 3 subjects with the highest recent mastery, for the progress bars. */
  subjectProgress: SubjectProgress[];
}

const TOP_SUBJECTS = 3;

export async function computeLearnerReportKpis(
  learnerId: string,
  tenantId: string,
): Promise<LearnerReportKpis> {
  const [runs, mastery, snapshots, iep, subjects] = await Promise.all([
    listLessonRunsForLearner(learnerId, tenantId),
    getMasteryMap(learnerId, tenantId),
    listMasterySnapshots(learnerId, tenantId),
    getIEPForLearner(learnerId, tenantId),
    listSubjects(),
  ]);

  const completed = runs.filter((r) => r.status === "completed");
  const { skillMasteries } = mastery;
  const overallAvg =
    skillMasteries.length === 0
      ? 0
      : skillMasteries.reduce((a, m) => a + m.score, 0) / skillMasteries.length;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { current, prior } = splitIntoPeriods(completed, thirtyDaysAgo);
  const completedDeltaPct = computeDeltaPct(current.length, prior.length);

  // Latest snapshot per subject → progress bars (highest mastery first).
  const latestBySubject = new Map<string, MasterySnapshot>();
  for (const s of snapshots) {
    const prev = latestBySubject.get(s.subjectId);
    if (!prev || s.capturedAt > prev.capturedAt) latestBySubject.set(s.subjectId, s);
  }
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const subjectProgress: SubjectProgress[] = [...latestBySubject.values()]
    .map((s) => ({
      subjectId: s.subjectId,
      subject: subjectName.get(s.subjectId) ?? s.subjectId,
      pct: Math.round(s.averageScore * 100),
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, TOP_SUBJECTS);

  return {
    overallMasteryPct: Math.round(overallAvg * 100),
    // No standalone mastery-over-time metric exists; the reports page has
    // always used the completed-lessons trend as the engagement proxy here.
    overallMasteryDeltaPct: prior.length > 0 ? completedDeltaPct : null,
    completedCount: completed.length,
    completedDeltaPct,
    skillsTracked: skillMasteries.length,
    iepSupportsCount: iep?.acceptedAccommodations?.length ?? 0,
    iepActive: !!iep?.confirmedAt,
    subjectProgress,
  };
}

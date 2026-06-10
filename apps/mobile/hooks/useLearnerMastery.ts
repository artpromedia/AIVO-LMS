import { useMemo } from "react";
import { useBrainDomains } from "@/hooks/useBrain";
import { useLearner } from "@/hooks/useLearners";

/**
 * Current per-subject mastery breakdown for a learner.
 *
 * Derived from brain-svc domain mastery (already used on the progress
 * screen). Returns the top `maxSubjects` subjects sorted highest-first.
 *
 * Returns `{ subjects, isLoading }`. `subjects` is empty while loading or
 * when no brain data is available, so callers can omit the BarMini without
 * extra guards.
 */
export interface MasterySubject {
  name: string;
  /** 0..100 mastery percentage. */
  value: number;
}

export interface LearnerMasteryResult {
  subjects: MasterySubject[];
  isLoading: boolean;
}

export function useLearnerMastery(learnerId: string, maxSubjects = 5): LearnerMasteryResult {
  const { data: learner } = useLearner(learnerId);
  const { domains, isLoading } = useBrainDomains(learnerId, {
    enrolledGrade: learner?.gradeLevel ?? null,
  });

  const subjects = useMemo<MasterySubject[]>(() => {
    if (!domains || domains.length === 0) return [];
    return domains
      .map((d) => ({
        name: d.domain,
        value: Math.round(d.masteryPercent),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, maxSubjects);
  }, [domains, maxSubjects]);

  return { subjects, isLoading };
}

import { getStore } from "@/lib/db/store";
import type { LearnerProfile, ReadinessState } from "@/lib/db/types";

export const READINESS_LABEL: Record<ReadinessState, string> = {
  profile_created: "Profile created",
  assessment_needed: "Assessment needed",
  iep_optional: "Add an IEP (optional)",
  baseline_needed: "Baseline assessment ready",
  ready_for_today_mission: "Ready for today's mission",
  active_learning: "Active learning",
};

export const READINESS_TONE: Record<
  ReadinessState,
  "neutral" | "warning" | "primary" | "success"
> = {
  profile_created: "neutral",
  assessment_needed: "warning",
  iep_optional: "primary",
  baseline_needed: "primary",
  ready_for_today_mission: "success",
  active_learning: "success",
};

/** What the parent should do next for this learner. Always actionable, never dead. */
export const READINESS_NEXT_STEP: Record<
  ReadinessState,
  { label: string; hrefTemplate: string }
> = {
  profile_created: {
    label: "Start parent assessment",
    hrefTemplate: "/parent/learners/{learnerId}/assessment",
  },
  assessment_needed: {
    label: "Continue parent assessment",
    hrefTemplate: "/parent/learners/{learnerId}/assessment",
  },
  iep_optional: {
    label: "Add an IEP or skip",
    hrefTemplate: "/parent/learners/{learnerId}/iep",
  },
  baseline_needed: {
    label: "Start baseline assessment",
    hrefTemplate: "/parent/learners/{learnerId}/baseline",
  },
  ready_for_today_mission: {
    label: "Open today's mission",
    hrefTemplate: "/parent/learners/{learnerId}",
  },
  active_learning: {
    label: "See growth report",
    hrefTemplate: "/parent/learners/{learnerId}",
  },
};

export function nextStepFor(learner: Pick<LearnerProfile, "id" | "readinessState">) {
  const tpl = READINESS_NEXT_STEP[learner.readinessState];
  return { label: tpl.label, href: tpl.hrefTemplate.replace("{learnerId}", learner.id) };
}

/**
 * Compute readiness from the source-of-truth records. The learner's stored
 * `readinessState` is a cache updated whenever progress is made; this function
 * is the canonical re-derivation.
 *
 * Sprints 6–8 will plug in real IEP + baseline + lesson-run checks; today
 * the only signal available is parent assessment submission.
 */
export function computeReadinessFor(learnerId: string, tenantId: string): ReadinessState {
  const store = getStore();
  const learner = store.learnerProfiles.get(learnerId);
  if (!learner || learner.tenantId !== tenantId) return "profile_created";

  const assessment = Array.from(store.parentAssessments.values()).find(
    (a) => a.learnerId === learnerId && a.tenantId === tenantId,
  );
  const hasIep = Array.from(store.iepDocuments.values()).some(
    (d) => d.learnerId === learnerId && d.tenantId === tenantId,
  );
  // Sprint 6: parent's explicit decision on the optional IEP step.
  const iepDecided = hasIep || learner.iepDecision === "skipped";
  const baseline = Array.from(store.baselineAssessments.values()).find(
    (b) =>
      b.learnerId === learnerId && b.tenantId === tenantId && b.status === "complete",
  );
  const lessonRunCount = Array.from(store.lessonRuns.values()).filter(
    (l) => l.learnerId === learnerId && l.tenantId === tenantId,
  ).length;

  if (lessonRunCount > 0) return "active_learning";
  if (baseline) return "ready_for_today_mission";
  if (assessment?.submittedAt) {
    return iepDecided ? "baseline_needed" : "iep_optional";
  }
  if (assessment && assessment.completedSections.length > 0) {
    return "assessment_needed";
  }
  return "profile_created";
}

import { getPersistence } from "@/lib/db/persistence";
import type { LearnerProfile, ReadinessState } from "@/lib/db/types";

export const READINESS_LABEL: Record<ReadinessState, string> = {
  profile_created: "Profile created",
  assessment_needed: "Assessment needed",
  iep_optional: "Add an IEP (optional)",
  baseline_needed: "Baseline assessment ready",
  brain_clone_review_needed: "Brain clone ready for review",
  ready_for_today_mission: "Ready for today's mission",
  active_learning: "Active learning",
};

export const READINESS_TONE: Record<ReadinessState, "neutral" | "warning" | "primary" | "success"> =
  {
    profile_created: "neutral",
    assessment_needed: "warning",
    iep_optional: "primary",
    baseline_needed: "primary",
    brain_clone_review_needed: "primary",
    ready_for_today_mission: "success",
    active_learning: "success",
  };

/** What the parent should do next for this learner. Always actionable, never dead. */
export const READINESS_NEXT_STEP: Record<ReadinessState, { label: string; hrefTemplate: string }> =
  {
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
    brain_clone_review_needed: {
      label: "Review brain clone",
      hrefTemplate: "/parent/learners/{learnerId}/brain-clone-watch",
    },
    ready_for_today_mission: {
      // Bounces through the active-learner route handler so the cookie is
      // set and the parent lands on the learner home — without it the CTA
      // would self-link back to this same parent detail page.
      label: "Open today's mission",
      hrefTemplate: "/learner/select/auto?learnerId={learnerId}",
    },
    active_learning: {
      label: "See growth report",
      hrefTemplate: "/parent/learners/{learnerId}/gradebook",
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
 * Reads go through the persistence adapter (ADR 0007) rather than the legacy
 * in-memory `getStore()` Maps. In `postgres` mode (required in production —
 * see `lib/env.ts`) those Maps are empty, so reading them directly here made
 * this function blind to all persisted progress and collapse every learner
 * back to `profile_created` — bouncing parents to "Start parent assessment"
 * even after the parent assessment and baseline were saved. Routing through
 * `getPersistence()` reads whichever backend is active and is correct in both
 * `memory` and `postgres` modes.
 */
export async function computeReadinessFor(
  learnerId: string,
  tenantId: string,
): Promise<ReadinessState> {
  const p = getPersistence();
  const learner = await p.learners.getById(learnerId, tenantId);
  if (!learner) return "profile_created";

  const [assessment, iep, baseline, lessonRunCount, brainProfile] = await Promise.all([
    p.assessments.findParentAssessment(learnerId, tenantId),
    p.compliance.getIEPForLearner(learnerId, tenantId),
    p.assessments.getActiveBaselineForLearner(learnerId, tenantId),
    p.lessonRuns.countForLearner(learnerId, tenantId),
    p.brainProfiles.getForLearner(learnerId, tenantId),
  ]);

  // Sprint 6: parent's explicit decision on the optional IEP step.
  const iepDecided = Boolean(iep) || learner.iepDecision === "skipped";
  const baselineComplete = baseline?.status === "complete" ? baseline : null;

  if (lessonRunCount > 0) return "active_learning";
  if (baselineComplete) {
    // Baseline finished — gate today's mission on the parent reviewing the
    // freshly cloned brain profile. If no clone is on file (legacy data or
    // an unexpected race), don't block the learner; fall through to
    // ready_for_today_mission so the CTA still works.
    if (brainProfile && brainProfile.cloneStage === "cloned") {
      return "brain_clone_review_needed";
    }
    return "ready_for_today_mission";
  }
  if (assessment?.submittedAt) {
    return iepDecided ? "baseline_needed" : "iep_optional";
  }
  if (assessment && assessment.completedSections.length > 0) {
    return "assessment_needed";
  }
  return "profile_created";
}

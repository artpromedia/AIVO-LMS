import { getPersistence } from "@/lib/db/persistence";
import { collaboratorInviteStepEnabled, visualBrainBuildEnabled } from "@/lib/feature-flags";
import type { LearnerProfile, ReadinessState } from "@/lib/db/types";

export const READINESS_LABEL: Record<ReadinessState, string> = {
  profile_created: "Profile created",
  assessment_needed: "Assessment needed",
  iep_optional: "Add an IEP (optional)",
  team_invite_optional: "Invite your child's team (optional)",
  baseline_needed: "Baseline assessment ready",
  brain_build_pending: "Building your child's brain",
  brain_clone_review_needed: "Brain clone ready for review",
  ready_for_today_mission: "Ready for today's mission",
  active_learning: "Active learning",
};

export const READINESS_TONE: Record<ReadinessState, "neutral" | "warning" | "primary" | "success"> =
  {
    profile_created: "neutral",
    assessment_needed: "warning",
    iep_optional: "primary",
    team_invite_optional: "primary",
    baseline_needed: "primary",
    brain_build_pending: "warning",
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
    team_invite_optional: {
      label: "Invite your child's team",
      hrefTemplate: "/parent/learners/{learnerId}/team?onboarding=1",
    },
    baseline_needed: {
      label: "Start baseline assessment",
      hrefTemplate: "/parent/learners/{learnerId}/baseline",
    },
    brain_build_pending: {
      label: "Finish building the brain",
      hrefTemplate: "/parent/learners/{learnerId}/brain-clone-watch",
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
    // freshly cloned brain profile.
    if (brainProfile && brainProfile.cloneStage === "cloned") {
      return "brain_clone_review_needed";
    }
    // Already approved → proceed to the mission.
    if (brainProfile && brainProfile.cloneStage === "approved") {
      return "ready_for_today_mission";
    }
    // Sprint 5: baseline done but no cloned/approved profile. Don't silently
    // skip the visual build — route to an actionable brain_build_pending
    // surface with a rebuild action. Flag OFF preserves the prior
    // fall-through to ready_for_today_mission so the change is reversible.
    if (visualBrainBuildEnabled()) {
      return "brain_build_pending";
    }
    return "ready_for_today_mission";
  }
  if (assessment?.submittedAt) {
    // Sprint 3: after the assessment is submitted, route the parent to the
    // optional "invite your child's team" step before the IEP/baseline
    // branch — unless they've explicitly decided (mirrors the iepDecision
    // pattern). Gated behind a feature flag so it's reversible: flag OFF
    // reproduces the exact prior behaviour.
    const teamInviteDecided =
      learner.teamInviteDecision === "done" || learner.teamInviteDecision === "skipped";
    if (collaboratorInviteStepEnabled() && !teamInviteDecided) {
      return "team_invite_optional";
    }
    return iepDecided ? "baseline_needed" : "iep_optional";
  }
  if (assessment && assessment.completedSections.length > 0) {
    return "assessment_needed";
  }
  return "profile_created";
}

/**
 * States that indicate a learner needs clinical/educational attention —
 * used by the therapist and caregiver home KPI strip.
 */
export const NEEDS_SUPPORT_STATES = new Set<ReadinessState>([
  "assessment_needed",
  "baseline_needed",
  "brain_clone_review_needed",
]);

export function needsSupportCount(learners: Pick<LearnerProfile, "readinessState">[]): number {
  return learners.filter((l) => NEEDS_SUPPORT_STATES.has(l.readinessState)).length;
}

/**
 * Maps a READINESS_TONE value to the Tailwind class string for an inline
 * status pill used in caseload / care-team learner rows.
 */
export function readinessBadgeClass(tone: "neutral" | "warning" | "primary" | "success"): string {
  switch (tone) {
    case "success":
      return "bg-[var(--aivo-color-status-success-subtle)] text-[var(--aivo-color-status-success-strong)] border-[var(--aivo-color-status-success-default)]";
    case "warning":
      return "bg-[var(--aivo-color-status-warning-subtle)] text-[var(--aivo-color-status-warning-strong)] border-[var(--aivo-color-status-warning-default)]";
    case "primary":
      return "bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-color-aivoPurple-700)] border-[var(--aivo-color-aivoPurple-100)]";
    default:
      return "bg-[var(--aivo-color-surface-muted)] text-[var(--aivo-color-text-muted)] border-[var(--aivo-color-border-subtle)]";
  }
}

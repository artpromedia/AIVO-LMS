import { randomUUID } from "node:crypto";
import { hasSufficientEvidence } from "./recommendation-policy.js";
import type { LearnerSignal } from "./recommendation-evidence-builder.js";
import { buildEvidenceFromSignals } from "./recommendation-evidence-builder.js";
import type { ProfileRecommendation, ProfileRecommendationType } from "./types.js";

export interface GenerateCandidatesInput {
  learnerId: string;
  signals: LearnerSignal[];
  currentProfile: {
    accommodations?: string[];
    functioningLevel?: string;
    deliveryLevel?: string;
    /** Enrolled grade band — required for upward progression candidates. */
    gradeBand?: string;
    /** ISO time of the last completed baseline — drives rebaseline checks. */
    baselineCompletedAt?: string;
    preferredInteractionModes?: string[];
    sensoryProfile?: Record<string, unknown>;
  };
}

interface Candidate {
  type: ProfileRecommendationType;
  title: string;
  parentSummary: string;
  currentValue: unknown;
  proposedValue: unknown;
  matches: (signals: LearnerSignal[]) => LearnerSignal[];
  affectsIEP?: boolean;
  affectsInstructionalAccess?: boolean;
  reversible?: boolean;
}

const CANDIDATES: Candidate[] = [
  {
    type: "preferred_surface_change",
    title: "Add scratchpad as a preferred surface",
    parentSummary:
      "Your learner solves more problems correctly when a scratchpad is available. We recommend marking scratchpad as a preferred surface.",
    currentValue: "no_preferred_surface",
    proposedValue: "scratchpad",
    matches: (signals) =>
      signals.filter(
        (s) =>
          (s.metric === "scratchpad_success_rate" &&
            typeof s.value === "number" &&
            s.value >= 0.7) ||
          (s.metric === "no_scratchpad_success_rate" &&
            typeof s.value === "number" &&
            s.value <= 0.4),
      ),
    reversible: true,
  },
  {
    type: "preferred_surface_change",
    title: "Add geometry workspace for geometry tasks",
    parentSummary:
      "Geometry items improve when a labeled diagram is shown. We recommend adding geometry_workspace for geometry tasks.",
    currentValue: "no_geometry_workspace",
    proposedValue: "geometry_workspace",
    matches: (signals) =>
      signals.filter(
        (s) =>
          s.metric === "geometry_with_diagram_success_lift" &&
          typeof s.value === "number" &&
          s.value >= 0.2,
      ),
    reversible: true,
  },
  {
    type: "self_regulation_support_add",
    title: "Add self-regulation prompts during homework",
    parentSummary:
      "Frustration signals during homework suggest self-regulation prompts could help. We recommend turning on short breathing breaks and smaller-step prompts.",
    currentValue: "off",
    proposedValue: "on",
    matches: (signals) =>
      signals.filter(
        (s) =>
          (s.metric === "homework_frustration_count" &&
            typeof s.value === "number" &&
            s.value >= 2) ||
          (s.metric === "homework_high_eraser" && typeof s.value === "number" && s.value >= 2),
      ),
    reversible: true,
  },
  {
    type: "delivery_level_change",
    title: "Lower delivery level",
    parentSummary:
      "Long text prompts correlate with abandonment. We recommend lowering the delivery level so prompts are shorter.",
    currentValue: "current",
    proposedValue: "lower",
    matches: (signals) =>
      signals.filter(
        (s) =>
          s.metric === "long_text_abandon_rate" && typeof s.value === "number" && s.value >= 0.4,
      ),
    affectsInstructionalAccess: true,
    reversible: true,
  },
  {
    type: "mastery_adjustment",
    title: "Adjust mastery level",
    parentSummary: "Baseline and recent work suggest the current mastery level needs adjustment.",
    currentValue: "current",
    proposedValue: "adjusted",
    matches: (signals) =>
      signals.filter(
        (s) =>
          s.source === "baseline" &&
          s.metric === "mastery_signal" &&
          typeof s.value === "number" &&
          Math.abs(s.value) >= 0.7,
      ),
    affectsInstructionalAccess: true,
    reversible: true,
  },
  // ── Observation-derived candidates (Sprint 5, G1/G2) ──────────────────
  // Fire on signals produced by observation-signal-transformer from
  // teacher/caregiver/therapist observations. Each still requires parent
  // approval and cites the contributing source(s) in its evidence.
  {
    type: "sensory_setting_change",
    title: "Adjust sensory settings",
    parentSummary:
      "Members of the care team have reported sensory overload. We recommend calmer sensory settings (reduced motion, quieter audio) during sessions.",
    currentValue: "default",
    proposedValue: "calm",
    matches: (signals) => signals.filter((s) => s.metric.endsWith("_reports_sensory_overload")),
    reversible: true,
  },
  {
    type: "self_regulation_support_add",
    title: "Add self-regulation support (care-team reported)",
    parentSummary:
      "Care-team observations point to focus or self-regulation difficulty. We recommend turning on self-regulation prompts and short breaks.",
    currentValue: "off",
    proposedValue: "on",
    matches: (signals) =>
      signals.filter(
        (s) =>
          s.metric.endsWith("_reports_focus_drop") ||
          s.metric.endsWith("_reports_regulation_difficulty"),
      ),
    reversible: true,
  },
  {
    type: "tutor_strategy_change",
    title: "Adjust tutor strategy (care-team reported)",
    parentSummary:
      "Care-team observations report lower engagement or academic struggle. We recommend a tutor strategy change (more scaffolding and interest-led framing).",
    currentValue: "current",
    proposedValue: "scaffold_and_interest_led",
    matches: (signals) =>
      signals.filter(
        (s) =>
          s.metric.endsWith("_reports_engagement_drop") ||
          s.metric.endsWith("_reports_academic_struggle"),
      ),
    reversible: true,
  },
];

export function generateRecommendations(input: GenerateCandidatesInput): ProfileRecommendation[] {
  const now = new Date().toISOString();
  const recommendations: ProfileRecommendation[] = [];
  for (const candidate of CANDIDATES) {
    const matched = candidate.matches(input.signals);
    if (matched.length === 0) continue;
    if (!hasSufficientEvidence(matched)) continue;
    recommendations.push({
      id: randomUUID(),
      learnerId: input.learnerId,
      type: candidate.type,
      title: candidate.title,
      parentSummary: candidate.parentSummary,
      currentValue: candidate.currentValue,
      proposedValue: candidate.proposedValue,
      confidence: Math.min(0.95, 0.5 + 0.1 * matched.length),
      evidence: buildEvidenceFromSignals(matched),
      safety: {
        requiresParentApproval: true,
        affectsIEP: candidate.affectsIEP ?? false,
        affectsInstructionalAccess: candidate.affectsInstructionalAccess ?? false,
        reversible: candidate.reversible ?? true,
      },
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    });
  }
  return recommendations;
}

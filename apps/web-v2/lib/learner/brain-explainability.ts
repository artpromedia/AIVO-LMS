/**
 * Sprint A1 — server-side selector that returns the XAI + RAI slice of a
 * learner's brain profile, ready to be consumed by the upcoming
 * BrainExplainabilityPanel (Sprint A2) and the parent approval gate
 * (Sprint A4).
 *
 * The function intentionally returns a *narrow* shape — only the
 * fields the explainability UI cares about — so callers don't have
 * to thread the full `LearnerBrainProfileState` through React server
 * components. It also normalises away the difference between the
 * deterministic-fallback brain profile (which emits only the flat
 * string summaries on `xaiExplanation`) and the real `brain-svc`
 * clone pipeline output (which emits the richer `*Detailed` arrays
 * and `raiComplianceDetail` object).
 *
 * Parity reference: `services/brain-svc/src/brain_svc/services/clone_pipeline.py`
 * `_build_xai_explanation` (~lines 93–195).
 */
import { getBrainProfile } from "@/lib/db/repos";
import type {
  BrainAccommodationDecision,
  BrainMasteryDecision,
  BrainRaiCompliance,
  BrainSignalDecision,
  BrainTutorDecision,
  LearnerBrainProfileState,
} from "@/lib/db/types";

export type BrainExplainabilitySource = "ai_generated" | "deterministic_fallback";

export type BrainExplainability = {
  /** Per-subject mastery scores in [0, 1], keyed by domain. */
  masteryLevels: Record<string, number>;
  /** Plain-language summary of the clone's reasoning. */
  summary: string;
  /** Whether the clone passes the basic RAI compliance checks. */
  raiCompliance: boolean;
  /** Detailed RAI panel content. Synthesised for the deterministic-fallback
   *  path so the UI never has to render an empty RAI tab. */
  raiComplianceDetail: BrainRaiCompliance;
  masteryDecisionsDetailed: BrainMasteryDecision[];
  accommodationDecisionsDetailed: BrainAccommodationDecision[];
  tutorDecisionsDetailed: BrainTutorDecision[];
  signalDecisionsDetailed: BrainSignalDecision[];
  /** Flat-string fallbacks always present, even when the detailed
   *  arrays are empty. Useful for the "calm" reduced-motion render. */
  masteryDecisions: string[];
  accommodationDecisions: string[];
  tutorDecisions: string[];
  /** Where the explainability data came from. */
  source: BrainExplainabilitySource;
};

/**
 * Default RAI disclosures shown when the clone pipeline did not attach
 * a `raiComplianceDetail` payload (deterministic fallback path or older
 * snapshots). Mirrors the static text in `_build_xai_explanation`.
 */
const DEFAULT_RAI_COMPLIANCE: BrainRaiCompliance = {
  dataSources: [],
  biasMitigations: [
    "Mastery scores derived from learner's own performance, not demographic data",
    "Accommodations selected from evidence-based templates, not assumptions",
    "Parent context treated as supplementary—never overrides learner-demonstrated ability",
  ],
  transparency:
    "All decisions below include the reasoning and source data that informed them.",
  humanOversight: "This brain clone requires parent approval before activation.",
};

export function selectBrainExplainability(
  state: LearnerBrainProfileState,
): BrainExplainability {
  const xai = state.xaiExplanation;

  const raiComplianceDetail: BrainRaiCompliance = xai.raiComplianceDetail
    ? {
        // Defensive copy + ensure dataSources is at minimum a non-empty list
        // describing the deterministic-fallback origin.
        dataSources: [...xai.raiComplianceDetail.dataSources],
        biasMitigations: [...xai.raiComplianceDetail.biasMitigations],
        transparency: xai.raiComplianceDetail.transparency,
        humanOversight: xai.raiComplianceDetail.humanOversight,
      }
    : {
        ...DEFAULT_RAI_COMPLIANCE,
        dataSources:
          state.source === "deterministic_fallback"
            ? ["Deterministic fallback template (no LLM call)"]
            : [],
      };

  return {
    masteryLevels: { ...state.masteryLevels },
    summary: xai.summary,
    raiCompliance: xai.raiCompliance,
    raiComplianceDetail,
    masteryDecisionsDetailed: xai.masteryDecisionsDetailed ?? [],
    accommodationDecisionsDetailed: xai.accommodationDecisionsDetailed ?? [],
    tutorDecisionsDetailed: xai.tutorDecisionsDetailed ?? [],
    signalDecisionsDetailed: xai.signalDecisionsDetailed ?? [],
    masteryDecisions: [...xai.masteryDecisions],
    accommodationDecisions: [...xai.accommodationDecisions],
    tutorDecisions: [...xai.tutorDecisions],
    source: state.source,
  };
}

/**
 * Fetch the brain profile for the supplied learner + tenant and return
 * only the XAI / RAI explainability slice. Returns `null` when no brain
 * profile exists yet (pre-clone) so callers can branch on profile
 * presence without dereferencing.
 */
export async function getBrainExplainability(
  learnerId: string,
  tenantId: string,
): Promise<BrainExplainability | null> {
  const profile = await getBrainProfile(learnerId, tenantId);
  if (!profile) return null;
  return selectBrainExplainability(profile.state);
}

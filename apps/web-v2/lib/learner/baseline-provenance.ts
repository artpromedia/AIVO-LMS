/**
 * Wave A (G2) — map baseline generation metadata onto the honest
 * parent-facing provenance badge.
 *
 * Three states:
 *   child_specific → the live LLM tiers (Discovery Adventure / flat LLM)
 *                    fused this child's parent assessment, IEP, teacher /
 *                    therapist context into the questions.
 *   cohort_bank    → the offline LLM-generated bank, matched to the
 *                    learner's grade band + functioning level +
 *                    accommodation tags — real AI content, but not fused
 *                    to this child.
 *   generic        → the deterministic fallback set ("Calm starter").
 *
 * Back-compat: rows written before Wave A carry no `personalization`
 * field. For those, `source: "ai"` could have been either the bank or a
 * live LLM call — we classify them from the recorded `model` (the bank
 * writes its own provenance string via `bankModel()`), defaulting to
 * cohort_bank so the badge never overclaims.
 */
import type { BaselineGenerationMetadata, BaselinePersonalization } from "@/lib/db/types";

export type BaselineProvenance = {
  personalization: BaselinePersonalization;
  /** i18n key under the `parent.learner_baseline` namespace. */
  i18nKey: "provenance_child_specific" | "provenance_cohort_bank" | "provenance_generic";
  /** Tone for the shared <Badge> component. */
  tone: "primary" | "neutral";
};

const BY_PERSONALIZATION: Record<BaselinePersonalization, BaselineProvenance> = {
  child_specific: {
    personalization: "child_specific",
    i18nKey: "provenance_child_specific",
    tone: "primary",
  },
  cohort_bank: {
    personalization: "cohort_bank",
    i18nKey: "provenance_cohort_bank",
    tone: "primary",
  },
  generic: {
    personalization: "generic",
    i18nKey: "provenance_generic",
    tone: "neutral",
  },
};

/** Prefix of the provenance string `bankModel()` records on bank picks. */
const BANK_MODEL_PREFIX = "bank/";

export function baselineProvenance(
  metadata: BaselineGenerationMetadata | undefined | null,
): BaselineProvenance {
  // No metadata at all (pre-Sprint-B2 rows): say the least we can defend.
  if (!metadata) return BY_PERSONALIZATION.generic;

  if (metadata.personalization) {
    return BY_PERSONALIZATION[metadata.personalization];
  }

  // Legacy rows (pre-Wave-A): derive from source + model.
  if (metadata.source === "fallback") return BY_PERSONALIZATION.generic;
  const model = metadata.model ?? "";
  if (model.startsWith(BANK_MODEL_PREFIX)) return BY_PERSONALIZATION.cohort_bank;
  // A legacy "ai" row with a non-bank model was a live LLM call.
  if (model.length > 0) return BY_PERSONALIZATION.child_specific;
  // "ai" with no model recorded: don't overclaim.
  return BY_PERSONALIZATION.cohort_bank;
}

import type { Activity, AdaptationProfile } from "@aivo/content-pack";
import type { FunctioningLevel } from "./types.js";
import { FUNCTIONING_LEVEL_ORDER, isDownhill } from "./types.js";
import { transformToSupported } from "./transforms/supported.js";
import { transformToLowVerbal } from "./transforms/lowVerbal.js";
import { transformToNonVerbal } from "./transforms/nonVerbal.js";
import { transformToPreSymbolic } from "./transforms/preSymbolic.js";

export type { FunctioningLevel } from "./types.js";
export { FUNCTIONING_LEVEL_ORDER, isDownhill } from "./types.js";
export { transformToSupported } from "./transforms/supported.js";
export { transformToLowVerbal } from "./transforms/lowVerbal.js";
export { transformToNonVerbal } from "./transforms/nonVerbal.js";
export { transformToPreSymbolic } from "./transforms/preSymbolic.js";

export interface TransformOptions {
  /** Default adaptation profile to apply (e.g. from `pack.defaultAdaptations`). */
  defaultAdaptations?: AdaptationProfile;
}

/**
 * Adapt an authored STANDARD-level activity to the target functioning
 * level. Returns the original activity unchanged if `target === "STANDARD"`.
 *
 * Throws when the requested transform is *uphill* — we never invent
 * additional content, only simplify.
 */
export function transformActivity(
  activity: Activity,
  target: FunctioningLevel,
  opts: TransformOptions = {},
): Activity {
  if (target === "STANDARD") return mergeAdaptations(activity, opts.defaultAdaptations);
  if (!isDownhill("STANDARD", target)) {
    // Defensive: should never trigger with the canonical 5-level ladder
    // but preserves intent if FUNCTIONING_LEVEL_ORDER is ever extended.
    throw new RangeError(`Cannot transform STANDARD → ${target} (not downhill)`);
  }
  // Each step composes: STANDARD → SUPPORTED → LOW_VERBAL → NON_VERBAL →
  // PRE_SYMBOLIC. Stopping early returns the in-between form.
  let a = mergeAdaptations(activity, opts.defaultAdaptations);
  if (FUNCTIONING_LEVEL_ORDER.indexOf(target) >= 1) a = transformToSupported(a);
  if (FUNCTIONING_LEVEL_ORDER.indexOf(target) >= 2) a = transformToLowVerbal(a);
  if (FUNCTIONING_LEVEL_ORDER.indexOf(target) >= 3) a = transformToNonVerbal(a);
  if (FUNCTIONING_LEVEL_ORDER.indexOf(target) >= 4) a = transformToPreSymbolic(a);
  return a;
}

function mergeAdaptations(
  activity: Activity,
  defaults: AdaptationProfile | undefined,
): Activity {
  if (!defaults) return activity;
  return {
    ...activity,
    adaptations: { ...defaults, ...(activity.adaptations ?? {}) },
  };
}

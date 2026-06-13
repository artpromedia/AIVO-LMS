/**
 * Baseline switch/AAC scanning — pure configuration helpers (Sprint C-15).
 *
 * The baseline runner lets a learner using a switch (single/dual) or an AAC
 * device complete the Discovery Adventure baseline independently. The input
 * itself is driven by `@aivo/aac-bridge` (`AACTargetProvider` + the
 * `SwitchScanController` it wraps) — exactly the mechanism the lesson player
 * already uses (`accessibility-shell.tsx`). This module owns only the small
 * amount of *pure* logic around that mechanism so it can be unit-tested
 * without a DOM:
 *
 *   - deciding WHETHER scanning is active for a learner's persisted prefs;
 *   - mapping the persisted `AccessibilityProfile` onto the bridge's session
 *     knobs (input method, dwell, and whether to run the auto-scan timer);
 *   - applying the sprint's conservative baseline dwell floor.
 *
 * Why a baseline-specific dwell floor: the contract default
 * (`DEFAULT_AAC_SCAN_DELAY_MS` = 1200ms) is tuned for the lesson player. The
 * baseline persona is a child, often neurodiverse, taking a first assessment;
 * the sprint mandates a more conservative default (~1.5–2s) so the highlight
 * never races ahead of a learner who is still reading the option. We never
 * *lower* a learner's explicitly-chosen delay — we only raise the floor when
 * the stored value is the untouched contract default.
 */
import {
  type AacInputMethod,
  clampScanDelayMs,
  DEFAULT_AAC_SCAN_DELAY_MS,
} from "@aivo/accessibility-contract";

/** Conservative auto-scan dwell for the baseline when the learner hasn't
 *  tuned it (sprint default: a calm ~1.8s, inside the spec's 1.5–2s band). */
export const BASELINE_DEFAULT_SCAN_DELAY_MS = 1800;

/** The persisted AAC fields the baseline scanning reads. A structural subset
 *  of `AccessibilityProfile` so callers can pass the full prefs object. */
export interface BaselineScanPrefs {
  aacEnabled: boolean;
  aacInputMethod: AacInputMethod;
  aacScanDelayMs: number;
}

/** The resolved configuration the client scan provider consumes. */
export interface BaselineScanConfig {
  /** True when a scanning input mode should drive the runner. */
  active: boolean;
  /** Bridge input method (only switch methods scan in the baseline). */
  inputMethod: AacInputMethod;
  /** Dwell / scan delay in ms, clamped to the contract bounds. */
  scanDelayMs: number;
  /**
   * Whether the auto-scan timer runs. Single-switch (`switch_1`) auto-scans;
   * two-switch (`switch_2`) is *step* scanning — the learner advances with one
   * switch and selects with the other, so the timer must be off.
   */
  autoScan: boolean;
  /** Step scanning (two switches) — the inverse of `autoScan`, surfaced for
   *  copy/telemetry that needs to name the mode. */
  stepScan: boolean;
}

/**
 * The AAC input methods the baseline drives via scanning. Eye-gaze and
 * head-pointer are *direct-select* methods: they activate targets through
 * their own dwell/pointer path (the bridge does not run the scan timer for
 * them), and the baseline does not build hardware drivers for them
 * (out of scope — consume the aac-bridge pipeline). So baseline scanning is
 * gated to the two switch methods; other methods leave the standard
 * pointer/keyboard runner untouched.
 */
export function isScanInputMethod(method: AacInputMethod): method is "switch_1" | "switch_2" {
  return method === "switch_1" || method === "switch_2";
}

/**
 * Resolve the persisted prefs into the baseline scan configuration. Returns
 * an inactive config (standard input) unless AAC is enabled AND the learner's
 * input method is a switch method — the runner then renders unchanged for
 * everyone else, satisfying the "never auto-enable by inference" rule (this
 * only reads an explicit, learner-set preference).
 */
export function resolveBaselineScanConfig(prefs: BaselineScanPrefs): BaselineScanConfig {
  const inputMethod = prefs.aacInputMethod;
  const active = prefs.aacEnabled === true && isScanInputMethod(inputMethod);

  // Raise the dwell to the baseline floor only when the stored value is the
  // untouched contract default; honour any value the learner actually chose.
  const rawDelay =
    prefs.aacScanDelayMs === DEFAULT_AAC_SCAN_DELAY_MS
      ? BASELINE_DEFAULT_SCAN_DELAY_MS
      : prefs.aacScanDelayMs;
  const scanDelayMs = clampScanDelayMs(rawDelay);

  const stepScan = inputMethod === "switch_2";
  return {
    active,
    inputMethod,
    scanDelayMs,
    autoScan: !stepScan,
    stepScan,
  };
}

/* --------------------- Readiness-screen suggestion -------------------- */

/**
 * The parent-assessment `learning_profile` fields that imply a learner uses
 * switch or eye-gaze access. Mirrors the functioning-level derivation in
 * `services/brain-svc/.../clone_pipeline.py` (switch_access / eye_gaze /
 * switch_scan) and the web validator enum
 * (`lib/validators/parent-assessment.ts`: responseMethod ∈ touch|voice|switch|eye_gaze).
 */
export interface ParentAssessmentInputSignals {
  /** `answers.learning_profile.responseMethod` — touch|voice|switch|eye_gaze. */
  responseMethod?: string;
  /** `answers.learning_profile.deviceInteraction`. */
  deviceInteraction?: string;
  /** `answers.learning_profile.communicationMode` — verbal|sign|aac|non_verbal. */
  communicationMode?: string;
}

/**
 * Decide whether the readiness screen should *suggest* button-friendly
 * (switch/AAC) mode. True when the parent assessment recorded a switch or
 * eye-gaze response method (or an AAC communication mode). This is a gentle,
 * dismissible suggestion only — it NEVER auto-enables scanning (activation is
 * always via the learner a11y settings page). Returns false once the learner
 * already has AAC enabled (nothing to suggest), so the prompt doesn't nag a
 * learner who's already set up.
 */
export function shouldSuggestButtonFriendlyMode(
  signals: ParentAssessmentInputSignals,
  alreadyEnabled: boolean,
): boolean {
  if (alreadyEnabled) return false;
  const response = signals.responseMethod ?? "";
  const device = signals.deviceInteraction ?? "";
  const comm = signals.communicationMode ?? "";
  return (
    response === "switch" ||
    response === "eye_gaze" ||
    device === "switch_access" ||
    device === "eye_gaze" ||
    comm === "aac"
  );
}

/**
 * Zod validation for the accessibility contract — the web BFF entry.
 *
 * Separated from `./index` so the React Native bundle (which imports only the
 * zero-dependency `index`) never pulls in Zod. The schema is built FROM the
 * canonical constants in `./index`, so the validated shape can never drift from
 * the declared type.
 */
import { z } from "zod";
import {
  AAC_INPUT_METHODS,
  ACCESSIBILITY_DEFAULTS,
  MAX_AAC_SCAN_DELAY_MS,
  MIN_AAC_SCAN_DELAY_MS,
  type AccessibilityProfile,
} from "./index";

// `satisfies` guarantees, at compile time, that this shape has exactly the keys
// of AccessibilityProfile — add a field to the type without a validator (or
// vice-versa) and the build fails. This is the drift guard.
const shape = {
  reducedMotion: z.boolean(),
  highContrast: z.boolean(),
  largeText: z.boolean(),
  dyslexiaFriendlyFont: z.boolean(),
  visualSupports: z.boolean(),
  audioFirst: z.boolean(),
  captionsAlwaysOn: z.boolean(),
  readAloud: z.boolean(),
  hapticsEnabled: z.boolean(),
  shorterSteps: z.boolean(),
  extraHints: z.boolean(),
  breakReminders: z.boolean(),
  keyboardOptimized: z.boolean(),
  aacEnabled: z.boolean(),
  aacInputMethod: z.enum(AAC_INPUT_METHODS),
  aacScanDelayMs: z.number().int().min(MIN_AAC_SCAN_DELAY_MS).max(MAX_AAC_SCAN_DELAY_MS),
} satisfies Record<keyof AccessibilityProfile, z.ZodTypeAny>;

export const AccessibilityProfileSchema = z.object(shape).strict();

/**
 * Partial + strict patch schema for PATCH requests: every field optional,
 * unknown keys rejected. This is the single validator the web accessibility
 * BFF route should use.
 */
export const AccessibilityPatchSchema = z.object(shape).partial().strict();

export type AccessibilityPatch = Partial<AccessibilityProfile>;

/** Apply a validated patch onto a base profile, falling back to defaults. */
export function applyAccessibilityPatch(
  base: AccessibilityProfile | undefined,
  patch: AccessibilityPatch,
): AccessibilityProfile {
  return { ...ACCESSIBILITY_DEFAULTS, ...(base ?? {}), ...patch };
}

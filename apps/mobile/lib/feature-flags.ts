/**
 * Mobile feature flags.
 *
 * Sprint 09 owns MOBILE_UNIFIED_APP, the migration flag for the
 * fragmented role-group shell → unified app + role switching.
 *
 * Flags resolve in this order:
 *   1. process.env.<NAME> (build-time replacement via Expo)
 *   2. default value declared here
 *
 * Default is `false` during the migration window so the legacy
 * role-group shells continue to ship until the unified shell reaches
 * parity. Flip to `true` in the same commit that removes the legacy
 * (parent)/(learner)/(teacher)/(caregiver)/(therapist) directories.
 */

function parseBoolEnv(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined || raw === "") return defaultValue;
  const lowered = raw.toLowerCase();
  if (["1", "true", "on", "yes"].includes(lowered)) return true;
  if (["0", "false", "off", "no"].includes(lowered)) return false;
  return defaultValue;
}

// Each flag must read its env var by literal name so Expo can statically
// inline EXPO_PUBLIC_* values at build time. Don't introduce a generic
// dynamic getter — it breaks Expo's static analysis.
export const MOBILE_FLAGS = {
  /**
   * When true, the app boots into the unified (app) shell at
   * `apps/mobile/app/(app)/_layout.tsx` and renders role-aware
   * screens by reading `RoleContext.activeRole`. When false, the
   * legacy (parent) / (learner) / (teacher) / (caregiver) /
   * (therapist) role groups still ship.
   */
  MOBILE_UNIFIED_APP: parseBoolEnv(process.env.EXPO_PUBLIC_MOBILE_UNIFIED_APP, false),
} as const;

export type MobileFlag = keyof typeof MOBILE_FLAGS;

export function isFlagOn(flag: MobileFlag): boolean {
  return MOBILE_FLAGS[flag];
}

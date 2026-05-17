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

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  const lowered = raw.toLowerCase();
  if (["1", "true", "on", "yes"].includes(lowered)) return true;
  if (["0", "false", "off", "no"].includes(lowered)) return false;
  return defaultValue;
}

export const MOBILE_FLAGS = {
  /**
   * When true, the app boots into the unified (app) shell at
   * `apps/mobile/app/(app)/_layout.tsx` and renders role-aware
   * screens by reading `RoleContext.activeRole`. When false, the
   * legacy (parent) / (learner) / (teacher) / (caregiver) /
   * (therapist) role groups still ship.
   */
  MOBILE_UNIFIED_APP: envFlag("EXPO_PUBLIC_MOBILE_UNIFIED_APP", false),
} as const;

export type MobileFlag = keyof typeof MOBILE_FLAGS;

export function isFlagOn(flag: MobileFlag): boolean {
  return MOBILE_FLAGS[flag];
}

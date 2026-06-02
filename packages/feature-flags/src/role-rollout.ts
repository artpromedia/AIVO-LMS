/**
 * Per-role rollout flags — ADR 0020 Phase 4, slice 4.5.
 *
 * Mobile and web ship one binary each (ADR 0020 §1). New roles —
 * therapist, caregiver, future "advisor" roles — must roll out per
 * environment **without a second app submission**. This module is
 * the typed accessor every layer (the role switcher,
 * `canAccessArea`, `buildRoleSession`, mobile `RoleProvider`) reads
 * to decide whether a role is enabled for the current environment.
 *
 * Defaults mirror the historical reach:
 *   - `learner`, `parent`, `teacher`, `schoolAdmin`, `districtAdmin`,
 *     `internal` default **on** in every environment (these are GA
 *     and have shipped to production for the entire 2025–26 sprint
 *     window).
 *   - `therapist` and `caregiver` default **on** in `development`
 *     and `staging`, and **off** in `production` until the GTM
 *     release flips the env var. This is the "dark-launched" mode
 *     ADR 0020 §Consequences describes.
 *
 * Each role can be forced on or off by setting the matching env var
 * (e.g. `AIVO_ROLE_THERAPIST_ENABLED=true`). The env-var name lives
 * next to the default so future audits don't have to grep two files.
 *
 * The `Role` literal type is duplicated here — kept identical to
 * `@aivo/nav`'s `Role` — so this package stays free of a `@aivo/nav`
 * dependency. A drift test in `__tests__/role-rollout.test.ts`
 * pins them together.
 */
import { readBooleanFromSource } from "./enterprise-flags.js";

/** The eight AIVO roles. Mirrors `Role` from `@aivo/nav`. */
export type RoleRolloutRoleId =
  | "learner"
  | "parent"
  | "teacher"
  | "therapist"
  | "caregiver"
  | "schoolAdmin"
  | "districtAdmin"
  | "internal";

export const ROLE_ROLLOUT_ROLES: readonly RoleRolloutRoleId[] = [
  "learner",
  "parent",
  "teacher",
  "therapist",
  "caregiver",
  "schoolAdmin",
  "districtAdmin",
  "internal",
] as const;

/** The three environments EAS profiles + web deploys map onto. */
export type RoleRolloutEnv = "development" | "staging" | "production";

/** Env-var names for the per-role rollout flag. */
export const ROLE_ROLLOUT_ENV_VARS: Record<RoleRolloutRoleId, string> = {
  learner: "AIVO_ROLE_LEARNER_ENABLED",
  parent: "AIVO_ROLE_PARENT_ENABLED",
  teacher: "AIVO_ROLE_TEACHER_ENABLED",
  therapist: "AIVO_ROLE_THERAPIST_ENABLED",
  caregiver: "AIVO_ROLE_CAREGIVER_ENABLED",
  schoolAdmin: "AIVO_ROLE_SCHOOL_ADMIN_ENABLED",
  districtAdmin: "AIVO_ROLE_DISTRICT_ADMIN_ENABLED",
  internal: "AIVO_ROLE_INTERNAL_ENABLED",
};

/**
 * Default rollout per role per environment. `true` ⇒ the role is
 * visible / activatable; `false` ⇒ the role is dark-launched and
 * resolves as `forbidden` in `canAccessArea`.
 *
 * Production defaults intentionally trail dev/staging so dark
 * launches don't require an emergency env-var push.
 */
export const ROLE_ROLLOUT_DEFAULTS: Record<RoleRolloutRoleId, Record<RoleRolloutEnv, boolean>> = {
  learner: { development: true, staging: true, production: true },
  parent: { development: true, staging: true, production: true },
  teacher: { development: true, staging: true, production: true },
  schoolAdmin: { development: true, staging: true, production: true },
  districtAdmin: { development: true, staging: true, production: true },
  internal: { development: true, staging: true, production: true },
  // Dark-launched in production until GTM flips the env var.
  therapist: { development: true, staging: true, production: false },
  caregiver: { development: true, staging: true, production: false },
};

/** Snapshot of the full role-rollout state for an environment. */
export type RoleRolloutFlags = Record<RoleRolloutRoleId, boolean>;

/**
 * Resolve every role's rollout state from a source map (defaults to
 * `process.env`). Env-var overrides win over the per-environment
 * default.
 */
export function resolveRoleRolloutFlags(
  env: RoleRolloutEnv,
  source: Record<string, string | undefined> = typeof process !== "undefined" && process?.env
    ? (process.env as Record<string, string | undefined>)
    : {},
): RoleRolloutFlags {
  const out = {} as RoleRolloutFlags;
  for (const role of ROLE_ROLLOUT_ROLES) {
    const defaultValue = ROLE_ROLLOUT_DEFAULTS[role][env];
    out[role] = readBooleanFromSource(source, ROLE_ROLLOUT_ENV_VARS[role], defaultValue);
  }
  return out;
}

/**
 * Convenience predicate. Returns `true` when the role is enabled for
 * the given environment (with env-var override applied).
 *
 * Callers that need the whole snapshot (e.g. `getRolesForSurface`,
 * `buildRoleSession`) should prefer `resolveRoleRolloutFlags` so
 * they don't re-read `process.env` once per role.
 */
export function isRoleEnabled(
  role: RoleRolloutRoleId,
  env: RoleRolloutEnv,
  source?: Record<string, string | undefined>,
): boolean {
  return resolveRoleRolloutFlags(env, source)[role];
}

/**
 * Filter a role list down to roles enabled for the current
 * environment. Pure helper consumed by `@aivo/nav`'s
 * `getRolesForSurface` and the mobile `RoleProvider`.
 */
export function filterEnabledRoles<T extends RoleRolloutRoleId>(
  roles: readonly T[],
  env: RoleRolloutEnv,
  source?: Record<string, string | undefined>,
): T[] {
  const flags = resolveRoleRolloutFlags(env, source);
  return roles.filter((r) => flags[r]);
}

import { describe, expect, it } from "vitest";
import {
  filterEnabledRoles,
  isRoleEnabled,
  resolveRoleRolloutFlags,
  ROLE_ROLLOUT_ROLES,
  type RoleRolloutEnv,
} from "../role-rollout.js";

describe("resolveRoleRolloutFlags — defaults", () => {
  it("enables every GA role in production", () => {
    const flags = resolveRoleRolloutFlags("production", {});
    expect(flags.learner).toBe(true);
    expect(flags.parent).toBe(true);
    expect(flags.teacher).toBe(true);
    expect(flags.schoolAdmin).toBe(true);
    expect(flags.districtAdmin).toBe(true);
    expect(flags.internal).toBe(true);
  });

  it("dark-launches therapist and caregiver in production", () => {
    const flags = resolveRoleRolloutFlags("production", {});
    expect(flags.therapist).toBe(false);
    expect(flags.caregiver).toBe(false);
  });

  it("enables therapist and caregiver in development and staging", () => {
    for (const env of ["development", "staging"] as const) {
      const flags = resolveRoleRolloutFlags(env, {});
      expect(flags.therapist).toBe(true);
      expect(flags.caregiver).toBe(true);
    }
  });
});

describe("resolveRoleRolloutFlags — env overrides", () => {
  it("env var enables a dark-launched role in production", () => {
    const flags = resolveRoleRolloutFlags("production", {
      AIVO_ROLE_THERAPIST_ENABLED: "true",
    });
    expect(flags.therapist).toBe(true);
  });

  it("env var disables a GA role", () => {
    const flags = resolveRoleRolloutFlags("production", {
      AIVO_ROLE_TEACHER_ENABLED: "false",
    });
    expect(flags.teacher).toBe(false);
  });

  it("ignores unknown env-var values and falls back to default", () => {
    const flags = resolveRoleRolloutFlags("production", {
      AIVO_ROLE_THERAPIST_ENABLED: "maybe",
    });
    expect(flags.therapist).toBe(false);
  });
});

describe("isRoleEnabled", () => {
  it("matches resolveRoleRolloutFlags for every role/env pair", () => {
    const envs: RoleRolloutEnv[] = ["development", "staging", "production"];
    for (const env of envs) {
      const all = resolveRoleRolloutFlags(env, {});
      for (const role of ROLE_ROLLOUT_ROLES) {
        expect(isRoleEnabled(role, env, {})).toBe(all[role]);
      }
    }
  });
});

describe("filterEnabledRoles", () => {
  it("removes dark-launched roles in production", () => {
    expect(
      filterEnabledRoles(
        ["parent", "therapist", "caregiver", "teacher"],
        "production",
        {},
      ),
    ).toEqual(["parent", "teacher"]);
  });

  it("keeps every role enabled by an env override", () => {
    expect(
      filterEnabledRoles(
        ["therapist", "caregiver"],
        "production",
        { AIVO_ROLE_THERAPIST_ENABLED: "true", AIVO_ROLE_CAREGIVER_ENABLED: "1" },
      ),
    ).toEqual(["therapist", "caregiver"]);
  });
});

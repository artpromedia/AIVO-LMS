/**
 * Sprint G + H — enterprise feature-flag reader tests.
 *
 * Confirms the BFF flag reader matches the env-var convention in
 * infra/k8s/base/enterprise/feature-flags-configmap.yaml — every
 * variant ("1", "true", "yes", "on", case-insensitive) is true and
 * anything else is false. The check is uncached so flipping the
 * ConfigMap takes effect at the next request.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { enterpriseFlags } from "./feature-flags";

const ENV_VAR = "AIVO_FEATURE_DATA_GOVERNANCE_CENTER";
const RBAC_ENV_VAR = "ADMIN_ENTERPRISE_DELEGATED_ADMIN_RBAC_V2";

describe("enterpriseFlags reader", () => {
  let original: string | undefined;
  let originalRbac: string | undefined;
  beforeEach(() => {
    original = process.env[ENV_VAR];
    originalRbac = process.env[RBAC_ENV_VAR];
  });
  afterEach(() => {
    if (original === undefined) delete process.env[ENV_VAR];
    else process.env[ENV_VAR] = original;
    if (originalRbac === undefined) delete process.env[RBAC_ENV_VAR];
    else process.env[RBAC_ENV_VAR] = originalRbac;
  });

  it("returns false when unset", () => {
    delete process.env[ENV_VAR];
    expect(enterpriseFlags.dataGovernanceCenter()).toBe(false);
  });

  it("accepts canonical truthy values", () => {
    for (const v of ["1", "true", "TRUE", "yes", "on", " ON "]) {
      process.env[ENV_VAR] = v;
      expect(enterpriseFlags.dataGovernanceCenter()).toBe(true);
    }
  });

  it("rejects falsy / unknown values", () => {
    for (const v of ["0", "false", "no", "", "off", "maybe"]) {
      process.env[ENV_VAR] = v;
      expect(enterpriseFlags.dataGovernanceCenter()).toBe(false);
    }
  });

  it("exposes all four Pair-4 flags", () => {
    expect(typeof enterpriseFlags.responsibleAiGuardrails()).toBe("boolean");
    expect(typeof enterpriseFlags.dataGovernanceCenter()).toBe("boolean");
    expect(typeof enterpriseFlags.sisSync()).toBe("boolean");
    expect(typeof enterpriseFlags.lti13()).toBe("boolean");
    expect(typeof enterpriseFlags.delegatedAdminRbacV2()).toBe("boolean");
  });

  it("reads the delegated admin rollout flag", () => {
    delete process.env[RBAC_ENV_VAR];
    expect(enterpriseFlags.delegatedAdminRbacV2()).toBe(false);
    process.env[RBAC_ENV_VAR] = "true";
    expect(enterpriseFlags.delegatedAdminRbacV2()).toBe(true);
  });
});

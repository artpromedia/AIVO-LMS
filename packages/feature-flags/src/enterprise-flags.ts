const TRUTHY_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSY_VALUES = new Set(["0", "false", "no", "off", ""]);

export function readBooleanFromSource(
  source: Record<string, string | undefined>,
  name: string,
  defaultValue: boolean,
): boolean {
  const raw = source[name];
  if (raw === undefined || raw === null) {
    return defaultValue;
  }
  const normalized = String(raw).trim().toLowerCase();
  if (TRUTHY_VALUES.has(normalized)) {
    return true;
  }
  if (FALSY_VALUES.has(normalized)) {
    return false;
  }
  return defaultValue;
}

export function booleanFromEnv(name: string, defaultValue: boolean): boolean {
  const env = typeof process !== "undefined" && process?.env ? process.env : {};
  return readBooleanFromSource(env as Record<string, string | undefined>, name, defaultValue);
}

export const ENTERPRISE_FLAG_ENV_VARS = {
  problemSessionLedger: "AIVO_FEATURE_PROBLEM_SESSION_LEDGER",
  tutorSurfaceProtocol: "AIVO_FEATURE_TUTOR_SURFACE_PROTOCOL",
  profileRecommendationsV2: "AIVO_FEATURE_PROFILE_RECOMMENDATIONS_V2",
  districtEnterpriseMode: "AIVO_FEATURE_DISTRICT_ENTERPRISE_MODE",
  sisSync: "AIVO_FEATURE_SIS_SYNC",
  lti13: "AIVO_FEATURE_LTI_13",
  dataGovernanceCenter: "AIVO_FEATURE_DATA_GOVERNANCE_CENTER",
  // ─── Sprint 14: responsible AI guardrails ────────────────────────────────
  // The four-detector pipeline (PII/IEP, prompt injection, crisis, age) ships
  // wired but DEFAULTS TO FALSE so merging Sprint 14 does not flip it on in
  // production. The flip itself is the canary-soak step described in
  // docs/SPRINT_12_SECURITY_REVIEW.md:
  //   1. enable in staging for 48h; verify red-team metrics & crisis paging
  //   2. sign-off from Trust & Safety + Engineering + Legal
  //   3. staged rollout 10% → 50% → 100% with 1h soak between steps
  // See docs/ai-safety/pipeline-architecture.md for the failure-mode contract
  // and docs/ai-safety/crisis-escalation-runbook.md for the operational
  // policy that fires when this flag is on.
  responsibleAiGuardrails: "AIVO_FEATURE_RESPONSIBLE_AI_GUARDRAILS",
  advancedContentGenerators: "AIVO_FEATURE_ADVANCED_CONTENT_GENERATORS",
  selfRegulationHub: "AIVO_FEATURE_SELF_REGULATION_HUB",
} as const;

export type EnterpriseFlagKey = keyof typeof ENTERPRISE_FLAG_ENV_VARS;

export type EnterpriseFeatureFlags = Record<EnterpriseFlagKey, boolean>;

export function resolveEnterpriseFlags(
  source: Record<string, string | undefined> = typeof process !== "undefined" && process?.env
    ? (process.env as Record<string, string | undefined>)
    : {},
): EnterpriseFeatureFlags {
  return {
    problemSessionLedger: readBooleanFromSource(
      source,
      ENTERPRISE_FLAG_ENV_VARS.problemSessionLedger,
      false,
    ),
    tutorSurfaceProtocol: readBooleanFromSource(
      source,
      ENTERPRISE_FLAG_ENV_VARS.tutorSurfaceProtocol,
      false,
    ),
    profileRecommendationsV2: readBooleanFromSource(
      source,
      ENTERPRISE_FLAG_ENV_VARS.profileRecommendationsV2,
      false,
    ),
    districtEnterpriseMode: readBooleanFromSource(
      source,
      ENTERPRISE_FLAG_ENV_VARS.districtEnterpriseMode,
      false,
    ),
    sisSync: readBooleanFromSource(source, ENTERPRISE_FLAG_ENV_VARS.sisSync, false),
    lti13: readBooleanFromSource(source, ENTERPRISE_FLAG_ENV_VARS.lti13, false),
    dataGovernanceCenter: readBooleanFromSource(
      source,
      ENTERPRISE_FLAG_ENV_VARS.dataGovernanceCenter,
      false,
    ),
    responsibleAiGuardrails: readBooleanFromSource(
      source,
      ENTERPRISE_FLAG_ENV_VARS.responsibleAiGuardrails,
      false,
    ),
    advancedContentGenerators: readBooleanFromSource(
      source,
      ENTERPRISE_FLAG_ENV_VARS.advancedContentGenerators,
      false,
    ),
    selfRegulationHub: readBooleanFromSource(
      source,
      ENTERPRISE_FLAG_ENV_VARS.selfRegulationHub,
      false,
    ),
  };
}

export const enterpriseFeatureFlags: EnterpriseFeatureFlags = {
  problemSessionLedger: booleanFromEnv(ENTERPRISE_FLAG_ENV_VARS.problemSessionLedger, false),
  tutorSurfaceProtocol: booleanFromEnv(ENTERPRISE_FLAG_ENV_VARS.tutorSurfaceProtocol, false),
  profileRecommendationsV2: booleanFromEnv(
    ENTERPRISE_FLAG_ENV_VARS.profileRecommendationsV2,
    false,
  ),
  districtEnterpriseMode: booleanFromEnv(ENTERPRISE_FLAG_ENV_VARS.districtEnterpriseMode, false),
  sisSync: booleanFromEnv(ENTERPRISE_FLAG_ENV_VARS.sisSync, false),
  lti13: booleanFromEnv(ENTERPRISE_FLAG_ENV_VARS.lti13, false),
  dataGovernanceCenter: booleanFromEnv(ENTERPRISE_FLAG_ENV_VARS.dataGovernanceCenter, false),
  responsibleAiGuardrails: booleanFromEnv(ENTERPRISE_FLAG_ENV_VARS.responsibleAiGuardrails, false),
  advancedContentGenerators: booleanFromEnv(
    ENTERPRISE_FLAG_ENV_VARS.advancedContentGenerators,
    false,
  ),
  selfRegulationHub: booleanFromEnv(ENTERPRISE_FLAG_ENV_VARS.selfRegulationHub, false),
};

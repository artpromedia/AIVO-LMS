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

// ---------------------------------------------------------------------------
// Sprint 12 — admin surface metadata. Pairs every flag with a human-
// readable label, description, and risk band so the platform-admin
// feature-flag UI can render a calm read-only inventory instead of
// guessing what AIVO_FEATURE_... env vars mean.
// ---------------------------------------------------------------------------

export type FlagRiskBand = "low" | "medium" | "high";

export interface FlagMeta {
  key: EnterpriseFlagKey;
  envVar: string;
  label: string;
  description: string;
  /** Where the flag's reach lives — used as the section heading. */
  surface: "ai" | "enterprise" | "integrations" | "ux";
  riskBand: FlagRiskBand;
  defaultValue: boolean;
}

export const ENTERPRISE_FLAG_META: Record<EnterpriseFlagKey, FlagMeta> = {
  problemSessionLedger: {
    key: "problemSessionLedger",
    envVar: ENTERPRISE_FLAG_ENV_VARS.problemSessionLedger,
    label: "Problem session ledger",
    description:
      "Persists every baseline / tutor / homework attempt into the problem-session ledger so cross-surface analytics can replay them.",
    surface: "enterprise",
    riskBand: "low",
    defaultValue: false,
  },
  tutorSurfaceProtocol: {
    key: "tutorSurfaceProtocol",
    envVar: ENTERPRISE_FLAG_ENV_VARS.tutorSurfaceProtocol,
    label: "Tutor surface protocol",
    description:
      "Enables the structured tutor-response protocol with strict surface validation. Required for geometry / scratchpad workspaces.",
    surface: "ai",
    riskBand: "medium",
    defaultValue: false,
  },
  profileRecommendationsV2: {
    key: "profileRecommendationsV2",
    envVar: ENTERPRISE_FLAG_ENV_VARS.profileRecommendationsV2,
    label: "Profile recommendations v2",
    description:
      "Brain-svc recommendation pipeline that scores accommodations + special interests jointly.",
    surface: "ai",
    riskBand: "medium",
    defaultValue: false,
  },
  districtEnterpriseMode: {
    key: "districtEnterpriseMode",
    envVar: ENTERPRISE_FLAG_ENV_VARS.districtEnterpriseMode,
    label: "District enterprise mode",
    description:
      "Activates district-scoped tenant routing, SSO / SCIM integration tabs, and the district admin reporting suite.",
    surface: "enterprise",
    riskBand: "high",
    defaultValue: false,
  },
  sisSync: {
    key: "sisSync",
    envVar: ENTERPRISE_FLAG_ENV_VARS.sisSync,
    label: "SIS sync",
    description: "Two-way roster sync with Clever / Classlink. When off, rostering is CSV-only.",
    surface: "integrations",
    riskBand: "high",
    defaultValue: false,
  },
  lti13: {
    key: "lti13",
    envVar: ENTERPRISE_FLAG_ENV_VARS.lti13,
    label: "LTI 1.3",
    description: "LTI 1.3 launch endpoints for embedding AIVO inside an LMS.",
    surface: "integrations",
    riskBand: "medium",
    defaultValue: false,
  },
  dataGovernanceCenter: {
    key: "dataGovernanceCenter",
    envVar: ENTERPRISE_FLAG_ENV_VARS.dataGovernanceCenter,
    label: "Data governance center",
    description: "DSAR / retention / data-inventory tooling under /admin/platform/compliance.",
    surface: "enterprise",
    riskBand: "low",
    defaultValue: false,
  },
  responsibleAiGuardrails: {
    key: "responsibleAiGuardrails",
    envVar: ENTERPRISE_FLAG_ENV_VARS.responsibleAiGuardrails,
    label: "Responsible-AI guardrails",
    description:
      "Sprint 4 baseline safety gate, content-generation evaluator, and tutor warn-mode checks. Off → fail open.",
    surface: "ai",
    riskBand: "medium",
    defaultValue: false,
  },
  advancedContentGenerators: {
    key: "advancedContentGenerators",
    envVar: ENTERPRISE_FLAG_ENV_VARS.advancedContentGenerators,
    label: "Advanced content generators",
    description:
      "Subject-specific generators (math word problems, science investigations, ELA passages). Off → use generic lesson generator.",
    surface: "ai",
    riskBand: "medium",
    defaultValue: false,
  },
  selfRegulationHub: {
    key: "selfRegulationHub",
    envVar: ENTERPRISE_FLAG_ENV_VARS.selfRegulationHub,
    label: "Self-regulation hub",
    description:
      "Learner-facing emotion / focus / break-time companion. Surfaced inside the stage runtime.",
    surface: "ux",
    riskBand: "low",
    defaultValue: false,
  },
};

export function listFlagMeta(): FlagMeta[] {
  return Object.values(ENTERPRISE_FLAG_META);
}

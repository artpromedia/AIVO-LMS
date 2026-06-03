/**
 * Responsible-AI model registry domain types.
 *
 * These back the platform-admin "Responsible AI Console" (Sprint 7):
 * a registry of every model in use, its safety policies, evaluation
 * results, incidents, per-tenant opt-outs and usage aggregates. The
 * shapes are intentionally aligned with the NIST AI RMF "Govern"
 * function so model cards can be rendered without a second mapping.
 */

export type ModelStatus = "draft" | "active" | "deprecated" | "retired";
export type ModelModality = "text" | "vision" | "speech" | "multimodal" | "embedding";

export interface ModelOwner {
  team: string;
  contact: string;
}

/** A registered model. Versions and the model card hang off the id. */
export interface ModelRecord {
  id: string;
  name: string;
  provider: string;
  modality: ModelModality;
  status: ModelStatus;
  owner: ModelOwner;
  intendedUse: string;
  /** NIST AI RMF GOVERN: documented out-of-scope / prohibited uses. */
  outOfScopeUse: string;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModelVersion {
  id: string;
  modelId: string;
  version: string;
  releasedAt: string;
  changelog: string;
  /** SHA-256 (or provider revision) for provenance / reproducibility. */
  provenanceHash: string;
}

/**
 * Model card. Markdown body plus the structured NIST AI RMF GOVERN
 * fields the DoD requires. `metadata` is rendered alongside the body.
 */
export interface ModelCard {
  modelId: string;
  markdown: string;
  metadata: {
    // GOVERN 1: policies, processes, accountability
    accountableOwner: string;
    riskTier: "low" | "limited" | "high" | "unacceptable";
    // GOVERN 2: documented roles & responsibilities
    intendedUse: string;
    outOfScopeUse: string;
    // GOVERN 3: workforce diversity / human oversight
    humanOversight: string;
    // GOVERN 4: org culture / incident escalation
    incidentEscalation: string;
    // GOVERN 5: stakeholder engagement
    stakeholders: string[];
    // GOVERN 6: supply-chain / third-party provenance
    provenance: string;
    trainingDataSummary: string;
    knownLimitations: string[];
    euAiActClassification: string;
    lastReviewedAt: string;
  };
}

export type PolicyScopeLevel = "platform" | "district" | "tenant";

/**
 * A safety policy. Policies stack platform → district → tenant; the
 * most specific scope that defines a field wins (see policy-resolution).
 */
export interface PolicyRecord {
  id: string;
  name: string;
  scopeLevel: PolicyScopeLevel;
  /** Null for platform-level (applies to all). */
  scopeId: string | null;
  contentSafety: {
    blockedCategories: string[];
    maxSeverity: "low" | "medium" | "high";
  };
  ageGating: {
    minAge: number | null;
    requireGuardianConsent: boolean;
  };
  regionRestrictions: {
    /** ISO-3166 alpha-2 country codes allowed; empty = all. */
    allowedRegions: string[];
    blockedRegions: string[];
  };
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface EffectivePolicy {
  tenantId: string;
  modelId: string;
  allowed: boolean;
  /** When blocked, the reason code (e.g. OPT_OUT, MODEL_RETIRED, REGION). */
  denyReason: string | null;
  contentSafety: PolicyRecord["contentSafety"];
  ageGating: PolicyRecord["ageGating"];
  regionRestrictions: PolicyRecord["regionRestrictions"];
  /** Ordered list of scopes that contributed, most general → most specific. */
  appliedScopes: Array<{ level: PolicyScopeLevel; id: string | null }>;
  computedAt: string;
}

export type EvalHarness = "safety-suite" | "accuracy-suite" | "bias-suite" | "full-suite";
export type EvalRunStatus = "queued" | "running" | "passed" | "failed";

export interface EvalMetricBreakdown {
  safety: number;
  accuracy: number;
  bias: number;
  refusalRate: number;
  hallucination: number;
}

export interface EvalRun {
  id: string;
  modelId: string;
  harness: EvalHarness;
  status: EvalRunStatus;
  metrics: EvalMetricBreakdown | null;
  /** Per-case results for drill-down. */
  cases: Array<{ id: string; metric: keyof EvalMetricBreakdown; passed: boolean; score: number }>;
  startedAt: string;
  completedAt: string | null;
  triggeredBy: string;
}

export type IncidentSeverity = "sev1" | "sev2" | "sev3" | "sev4";
export type IncidentState = "open" | "investigating" | "mitigated" | "resolved" | "closed";

export interface RaiIncident {
  id: string;
  modelId: string | null;
  tenantId: string | null;
  title: string;
  description: string;
  severity: IncidentSeverity;
  state: IncidentState;
  reportedBy: string;
  reportedByRole: string;
  timeline: Array<{ at: string; actor: string; state: IncidentState; note: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface OptOut {
  id: string;
  tenantId: string;
  /** Either a modelId, or a feature key (e.g. "ai-tutor", "speech-eval"). */
  modelId: string | null;
  feature: string | null;
  reason: string;
  createdBy: string;
  createdByRole: string;
  createdAt: string;
}

export interface UsageAggregate {
  modelId: string;
  tenantId: string;
  /** ISO date (day granularity). */
  date: string;
  calls: number;
  tokens: number;
  costUsd: number;
}

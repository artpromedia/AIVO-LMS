import "server-only";

import { cookies } from "next/headers";
import { IDENTITY_ACCESS_TOKEN_COOKIE } from "@aivo/admin-auth/identity-client";
import { securityRoleForWebRole } from "@aivo/admin-auth/permissions";
import type { SessionProfile } from "@aivo/admin-auth/types";
import { AdminApiError } from "./client.js";
import { internalServiceToken, raiSvcUrl } from "./env.js";

/**
 * Admin surface for the AI governance / Responsible AI console.
 *
 * Talks directly to responsible-ai-svc (the owning service, port 3071), which
 * holds the model registry, safety policies, evals, incidents and per-tenant
 * opt-outs. There is NO local/mock store — every call hits the live service.
 * Mirrors the direct-service pattern used by sis.ts.
 *
 *   GET   /api/responsible-ai/policies            -> { policies }
 *   PUT   /api/responsible-ai/policies/:id         -> { policy }
 *   GET   /api/responsible-ai/incidents            -> { incidents }
 *   POST  /api/responsible-ai/incidents            -> { incident }
 *   PATCH /api/responsible-ai/incidents/:id         -> { incident }
 *   GET   /api/responsible-ai/optouts?tenantId      -> { optOuts }
 *   POST  /api/responsible-ai/optouts               -> { optOut }
 *   DELETE /api/responsible-ai/optouts/:id           -> { removed }
 *   GET   /api/responsible-ai/models               -> { models }
 *   GET   /api/responsible-ai/models/:id/card       -> { model, card, versions }
 *   GET   /api/responsible-ai/evals                -> { runs }
 *   GET   /api/responsible-ai/evals/:runId          -> { run }
 */

type RaiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function raiRequest<T>(
  session: Pick<SessionProfile, "role">,
  method: RaiMethod,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = (await cookies()).get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
  if (!token) throw new AdminApiError("Missing admin access token", 401);

  const headers = new Headers({
    authorization: `Bearer ${token}`,
    "x-aivo-active-role": String(securityRoleForWebRole(session.role)),
  });
  if (body !== undefined) headers.set("content-type", "application/json");
  const serviceToken = internalServiceToken();
  if (serviceToken) headers.set("x-service-token", serviceToken);

  const response = await fetch(new URL(path, raiSvcUrl()), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `responsible-ai-svc request failed (${response.status})`;
    throw new AdminApiError(message, response.status, payload);
  }
  return payload as T;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  return asArray(value).map((v) => String(v));
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const v = String(value ?? "");
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

// ── Policies ───────────────────────────────────────────────────────────────

export type PolicyScopeLevel = "platform" | "district" | "tenant";
export type PolicyMaxSeverity = "low" | "medium" | "high";

export const POLICY_SCOPE_LEVELS: PolicyScopeLevel[] = ["platform", "district", "tenant"];
export const POLICY_MAX_SEVERITIES: PolicyMaxSeverity[] = ["low", "medium", "high"];

export interface AiPolicy {
  id: string;
  name: string;
  scopeLevel: PolicyScopeLevel;
  scopeId: string | null;
  contentSafety: {
    blockedCategories: string[];
    maxSeverity: PolicyMaxSeverity;
  };
  ageGating: {
    minAge: number | null;
    requireGuardianConsent: boolean;
  };
  regionRestrictions: {
    allowedRegions: string[];
    blockedRegions: string[];
  };
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
}

function mapPolicy(row: Record<string, unknown>): AiPolicy {
  const contentSafety = asRecord(row.contentSafety);
  const ageGating = asRecord(row.ageGating);
  const regionRestrictions = asRecord(row.regionRestrictions);
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? row.id ?? ""),
    scopeLevel: oneOf(row.scopeLevel, POLICY_SCOPE_LEVELS, "platform"),
    scopeId: row.scopeId ? String(row.scopeId) : null,
    contentSafety: {
      blockedCategories: asStringArray(contentSafety.blockedCategories),
      maxSeverity: oneOf(contentSafety.maxSeverity, POLICY_MAX_SEVERITIES, "low"),
    },
    ageGating: {
      minAge:
        ageGating.minAge === null || ageGating.minAge === undefined
          ? null
          : Number(ageGating.minAge),
      requireGuardianConsent: Boolean(ageGating.requireGuardianConsent),
    },
    regionRestrictions: {
      allowedRegions: asStringArray(regionRestrictions.allowedRegions),
      blockedRegions: asStringArray(regionRestrictions.blockedRegions),
    },
    enabled: Boolean(row.enabled),
    updatedAt: String(row.updatedAt ?? new Date(0).toISOString()),
    updatedBy: String(row.updatedBy ?? ""),
  };
}

export async function listAiPolicies(
  session: Pick<SessionProfile, "role">,
): Promise<AiPolicy[]> {
  const payload = await raiRequest<Record<string, unknown>>(
    session,
    "GET",
    "/api/responsible-ai/policies",
  );
  return asArray(payload.policies).map((row) => mapPolicy(asRecord(row)));
}

export async function updateAiPolicy(
  session: Pick<SessionProfile, "role">,
  id: string,
  patch: Partial<{
    name: string;
    scopeLevel: PolicyScopeLevel;
    scopeId: string | null;
    contentSafety: AiPolicy["contentSafety"];
    ageGating: AiPolicy["ageGating"];
    regionRestrictions: AiPolicy["regionRestrictions"];
    enabled: boolean;
  }>,
): Promise<AiPolicy> {
  const payload = await raiRequest<Record<string, unknown>>(
    session,
    "PUT",
    `/api/responsible-ai/policies/${encodeURIComponent(id)}`,
    patch,
  );
  return mapPolicy(asRecord(payload.policy));
}

// ── Incidents ──────────────────────────────────────────────────────────────

export type AiIncidentSeverity = "sev1" | "sev2" | "sev3" | "sev4";
export type AiIncidentState =
  | "open"
  | "investigating"
  | "mitigated"
  | "resolved"
  | "closed";

export const AI_INCIDENT_SEVERITIES: AiIncidentSeverity[] = ["sev1", "sev2", "sev3", "sev4"];
export const AI_INCIDENT_STATES: AiIncidentState[] = [
  "open",
  "investigating",
  "mitigated",
  "resolved",
  "closed",
];

export interface AiIncidentTimelineEntry {
  at: string;
  actor: string;
  state: AiIncidentState;
  note: string;
}

export interface AiIncident {
  id: string;
  modelId: string | null;
  tenantId: string | null;
  title: string;
  description: string;
  severity: AiIncidentSeverity;
  state: AiIncidentState;
  reportedBy: string;
  reportedByRole: string;
  timeline: AiIncidentTimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

function mapIncidentTimelineEntry(row: Record<string, unknown>): AiIncidentTimelineEntry {
  return {
    at: String(row.at ?? new Date(0).toISOString()),
    actor: String(row.actor ?? "unknown"),
    state: oneOf(row.state, AI_INCIDENT_STATES, "open"),
    note: String(row.note ?? ""),
  };
}

function mapIncident(row: Record<string, unknown>): AiIncident {
  return {
    id: String(row.id ?? ""),
    modelId: row.modelId ? String(row.modelId) : null,
    tenantId: row.tenantId ? String(row.tenantId) : null,
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    severity: oneOf(row.severity, AI_INCIDENT_SEVERITIES, "sev3"),
    state: oneOf(row.state, AI_INCIDENT_STATES, "open"),
    reportedBy: String(row.reportedBy ?? "unknown"),
    reportedByRole: String(row.reportedByRole ?? "unknown"),
    timeline: asArray(row.timeline).map((entry) => mapIncidentTimelineEntry(asRecord(entry))),
    createdAt: String(row.createdAt ?? new Date(0).toISOString()),
    updatedAt: String(row.updatedAt ?? new Date(0).toISOString()),
  };
}

export async function listAiIncidents(
  session: Pick<SessionProfile, "role">,
): Promise<AiIncident[]> {
  const payload = await raiRequest<Record<string, unknown>>(
    session,
    "GET",
    "/api/responsible-ai/incidents",
  );
  return asArray(payload.incidents).map((row) => mapIncident(asRecord(row)));
}

export async function createAiIncident(
  session: Pick<SessionProfile, "role">,
  input: {
    title: string;
    description: string;
    severity?: AiIncidentSeverity;
    modelId?: string | null;
    tenantId?: string | null;
  },
): Promise<AiIncident> {
  const payload = await raiRequest<Record<string, unknown>>(
    session,
    "POST",
    "/api/responsible-ai/incidents",
    input,
  );
  return mapIncident(asRecord(payload.incident));
}

export async function updateAiIncidentState(
  session: Pick<SessionProfile, "role">,
  id: string,
  patch: { state: AiIncidentState; note?: string },
): Promise<AiIncident> {
  const payload = await raiRequest<Record<string, unknown>>(
    session,
    "PATCH",
    `/api/responsible-ai/incidents/${encodeURIComponent(id)}`,
    patch,
  );
  return mapIncident(asRecord(payload.incident));
}

// ── Opt-outs ───────────────────────────────────────────────────────────────

export interface AiOptOut {
  id: string;
  tenantId: string;
  modelId: string | null;
  feature: string | null;
  reason: string;
  createdBy: string;
  createdByRole: string;
  createdAt: string;
}

function mapOptOut(row: Record<string, unknown>): AiOptOut {
  return {
    id: String(row.id ?? ""),
    tenantId: String(row.tenantId ?? ""),
    modelId: row.modelId ? String(row.modelId) : null,
    feature: row.feature ? String(row.feature) : null,
    reason: String(row.reason ?? ""),
    createdBy: String(row.createdBy ?? "unknown"),
    createdByRole: String(row.createdByRole ?? "unknown"),
    createdAt: String(row.createdAt ?? new Date(0).toISOString()),
  };
}

export async function listAiOptOuts(
  session: Pick<SessionProfile, "role">,
  tenantId?: string,
): Promise<AiOptOut[]> {
  const path = tenantId
    ? `/api/responsible-ai/optouts?tenantId=${encodeURIComponent(tenantId)}`
    : "/api/responsible-ai/optouts";
  const payload = await raiRequest<Record<string, unknown>>(session, "GET", path);
  return asArray(payload.optOuts).map((row) => mapOptOut(asRecord(row)));
}

export async function createAiOptOut(
  session: Pick<SessionProfile, "role">,
  input: {
    tenantId?: string;
    modelId?: string | null;
    feature?: string | null;
    reason?: string;
  },
): Promise<AiOptOut> {
  const payload = await raiRequest<Record<string, unknown>>(
    session,
    "POST",
    "/api/responsible-ai/optouts",
    input,
  );
  return mapOptOut(asRecord(payload.optOut));
}

export async function deleteAiOptOut(
  session: Pick<SessionProfile, "role">,
  id: string,
): Promise<{ removed: boolean }> {
  const payload = await raiRequest<Record<string, unknown>>(
    session,
    "DELETE",
    `/api/responsible-ai/optouts/${encodeURIComponent(id)}`,
  );
  return { removed: Boolean(payload.removed) };
}

// ── Models ─────────────────────────────────────────────────────────────────

export type AiModelStatus = "draft" | "active" | "deprecated" | "retired";
export type AiModelModality = "text" | "vision" | "speech" | "multimodal" | "embedding";

export const AI_MODEL_STATUSES: AiModelStatus[] = ["draft", "active", "deprecated", "retired"];
export const AI_MODEL_MODALITIES: AiModelModality[] = [
  "text",
  "vision",
  "speech",
  "multimodal",
  "embedding",
];

export interface AiModel {
  id: string;
  name: string;
  provider: string;
  modality: AiModelModality;
  status: AiModelStatus;
  owner: { team: string; contact: string };
  intendedUse: string;
  outOfScopeUse: string;
  currentVersionId: string | null;
  versions: number;
  createdAt: string;
  updatedAt: string;
}

function mapModel(row: Record<string, unknown>): AiModel {
  const owner = asRecord(row.owner);
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    provider: String(row.provider ?? ""),
    modality: oneOf(row.modality, AI_MODEL_MODALITIES, "text"),
    status: oneOf(row.status, AI_MODEL_STATUSES, "draft"),
    owner: {
      team: String(owner.team ?? "Unassigned"),
      contact: String(owner.contact ?? ""),
    },
    intendedUse: String(row.intendedUse ?? ""),
    outOfScopeUse: String(row.outOfScopeUse ?? ""),
    currentVersionId: row.currentVersionId ? String(row.currentVersionId) : null,
    versions: Number(row.versions ?? 0),
    createdAt: String(row.createdAt ?? new Date(0).toISOString()),
    updatedAt: String(row.updatedAt ?? new Date(0).toISOString()),
  };
}

export interface AiModelVersion {
  id: string;
  modelId: string;
  version: string;
  releasedAt: string;
  changelog: string;
  provenanceHash: string;
}

function mapModelVersion(row: Record<string, unknown>): AiModelVersion {
  return {
    id: String(row.id ?? ""),
    modelId: String(row.modelId ?? ""),
    version: String(row.version ?? ""),
    releasedAt: String(row.releasedAt ?? new Date(0).toISOString()),
    changelog: String(row.changelog ?? ""),
    provenanceHash: String(row.provenanceHash ?? ""),
  };
}

export type AiRiskTier = "low" | "limited" | "high" | "unacceptable";

export interface AiModelCard {
  modelId: string;
  markdown: string;
  metadata: {
    accountableOwner: string;
    riskTier: AiRiskTier;
    intendedUse: string;
    outOfScopeUse: string;
    humanOversight: string;
    incidentEscalation: string;
    stakeholders: string[];
    provenance: string;
    trainingDataSummary: string;
    knownLimitations: string[];
    euAiActClassification: string;
    lastReviewedAt: string;
  };
}

function mapModelCard(row: Record<string, unknown>): AiModelCard {
  const metadata = asRecord(row.metadata);
  return {
    modelId: String(row.modelId ?? ""),
    markdown: String(row.markdown ?? ""),
    metadata: {
      accountableOwner: String(metadata.accountableOwner ?? ""),
      riskTier: oneOf(
        metadata.riskTier,
        ["low", "limited", "high", "unacceptable"] as const,
        "low",
      ),
      intendedUse: String(metadata.intendedUse ?? ""),
      outOfScopeUse: String(metadata.outOfScopeUse ?? ""),
      humanOversight: String(metadata.humanOversight ?? ""),
      incidentEscalation: String(metadata.incidentEscalation ?? ""),
      stakeholders: asStringArray(metadata.stakeholders),
      provenance: String(metadata.provenance ?? ""),
      trainingDataSummary: String(metadata.trainingDataSummary ?? ""),
      knownLimitations: asStringArray(metadata.knownLimitations),
      euAiActClassification: String(metadata.euAiActClassification ?? ""),
      lastReviewedAt: String(metadata.lastReviewedAt ?? ""),
    },
  };
}

export async function listAiModels(
  session: Pick<SessionProfile, "role">,
): Promise<AiModel[]> {
  const payload = await raiRequest<Record<string, unknown>>(
    session,
    "GET",
    "/api/responsible-ai/models",
  );
  return asArray(payload.models).map((row) => mapModel(asRecord(row)));
}

export async function getAiModel(
  session: Pick<SessionProfile, "role">,
  id: string,
): Promise<{ model: AiModel; card: AiModelCard | null; versions: AiModelVersion[] }> {
  const payload = await raiRequest<Record<string, unknown>>(
    session,
    "GET",
    `/api/responsible-ai/models/${encodeURIComponent(id)}/card`,
  );
  return {
    model: mapModel(asRecord(payload.model)),
    card: payload.card ? mapModelCard(asRecord(payload.card)) : null,
    versions: asArray(payload.versions).map((row) => mapModelVersion(asRecord(row))),
  };
}

// ── Evals ──────────────────────────────────────────────────────────────────

export type AiEvalHarness = "safety-suite" | "accuracy-suite" | "bias-suite" | "full-suite";
export type AiEvalRunStatus = "queued" | "running" | "passed" | "failed";

export const AI_EVAL_HARNESSES: AiEvalHarness[] = [
  "safety-suite",
  "accuracy-suite",
  "bias-suite",
  "full-suite",
];
export const AI_EVAL_RUN_STATUSES: AiEvalRunStatus[] = ["queued", "running", "passed", "failed"];

export interface AiEvalMetricBreakdown {
  safety: number;
  accuracy: number;
  bias: number;
  refusalRate: number;
  hallucination: number;
}

export interface AiEvalCase {
  id: string;
  metric: keyof AiEvalMetricBreakdown;
  passed: boolean;
  score: number;
}

export interface AiEvalRun {
  id: string;
  modelId: string;
  harness: AiEvalHarness;
  status: AiEvalRunStatus;
  metrics: AiEvalMetricBreakdown | null;
  caseCount: number;
  startedAt: string;
  completedAt: string | null;
  triggeredBy: string;
}

function mapMetrics(value: unknown): AiEvalMetricBreakdown | null {
  if (!value || typeof value !== "object") return null;
  const m = value as Record<string, unknown>;
  return {
    safety: Number(m.safety ?? 0),
    accuracy: Number(m.accuracy ?? 0),
    bias: Number(m.bias ?? 0),
    refusalRate: Number(m.refusalRate ?? 0),
    hallucination: Number(m.hallucination ?? 0),
  };
}

function mapEvalRun(row: Record<string, unknown>): AiEvalRun {
  return {
    id: String(row.id ?? ""),
    modelId: String(row.modelId ?? ""),
    harness: oneOf(row.harness, AI_EVAL_HARNESSES, "full-suite"),
    status: oneOf(row.status, AI_EVAL_RUN_STATUSES, "queued"),
    metrics: mapMetrics(row.metrics),
    caseCount: Number(
      row.caseCount ?? (Array.isArray(row.cases) ? row.cases.length : 0),
    ),
    startedAt: String(row.startedAt ?? new Date(0).toISOString()),
    completedAt: row.completedAt ? String(row.completedAt) : null,
    triggeredBy: String(row.triggeredBy ?? ""),
  };
}

export interface AiEvalRunDetail extends AiEvalRun {
  cases: AiEvalCase[];
}

function mapEvalCase(row: Record<string, unknown>): AiEvalCase {
  return {
    id: String(row.id ?? ""),
    metric: oneOf(
      row.metric,
      ["safety", "accuracy", "bias", "refusalRate", "hallucination"] as const,
      "safety",
    ),
    passed: Boolean(row.passed),
    score: Number(row.score ?? 0),
  };
}

export async function listAiEvals(
  session: Pick<SessionProfile, "role">,
  modelId?: string,
): Promise<AiEvalRun[]> {
  const path = modelId
    ? `/api/responsible-ai/evals?modelId=${encodeURIComponent(modelId)}`
    : "/api/responsible-ai/evals";
  const payload = await raiRequest<Record<string, unknown>>(session, "GET", path);
  return asArray(payload.runs).map((row) => mapEvalRun(asRecord(row)));
}

export async function getAiEvalRun(
  session: Pick<SessionProfile, "role">,
  runId: string,
): Promise<AiEvalRunDetail> {
  const payload = await raiRequest<Record<string, unknown>>(
    session,
    "GET",
    `/api/responsible-ai/evals/${encodeURIComponent(runId)}`,
  );
  const run = asRecord(payload.run);
  return {
    ...mapEvalRun(run),
    cases: asArray(run.cases).map((row) => mapEvalCase(asRecord(row))),
  };
}

/**
 * responsible-ai-svc client for the Responsible AI Console (Sprint 7).
 *
 * Each method calls the upstream service via `callService`; on a read
 * failure it falls back to a small inline sample so the admin console and
 * the public /ai-transparency page render in the local/demo workflow with
 * no services running. Writes propagate failures to the caller.
 */
import { serverEnv } from "@/lib/env";
import { callService } from "./client";

const SERVICE = "responsible-ai-svc";
const base = () => serverEnv.RESPONSIBLE_AI_SVC_URL;

export interface RaiModel {
  id: string;
  name: string;
  provider: string;
  modality: string;
  status: string;
  owner: { team: string; contact: string };
  intendedUse: string;
  outOfScopeUse: string;
  currentVersionId: string | null;
  versions?: number;
  updatedAt: string;
}

export interface RaiEvalRun {
  id: string;
  modelId: string;
  harness: string;
  status: string;
  metrics: {
    safety: number;
    accuracy: number;
    bias: number;
    refusalRate: number;
    hallucination: number;
  } | null;
  startedAt: string;
  completedAt: string | null;
  triggeredBy: string;
}

export interface RaiIncident {
  id: string;
  modelId: string | null;
  tenantId: string | null;
  title: string;
  description: string;
  severity: string;
  state: string;
  reportedByRole: string;
  timeline: Array<{ at: string; actor: string; state: string; note: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface ModelCardMetadata {
  riskTier?: string;
  accountableOwner?: string;
  euAiActClassification?: string;
  intendedUse?: string;
  outOfScopeUse?: string;
  humanOversight?: string;
  incidentEscalation?: string;
  provenance?: string;
  trainingDataSummary?: string;
  knownLimitations?: string;
  lastReviewedAt?: string;
  stakeholders?: string[];
}

export interface ModelCardDoc {
  metadata?: ModelCardMetadata;
  body?: string;
}

export interface RaiModelVersion {
  id?: string;
  label?: string;
}

export interface RaiPolicy {
  id: string;
  name?: string;
  scopeLevel?: string;
  scopeId?: string;
  enabled?: boolean;
  updatedAt?: string;
  blockedCategories?: string[];
  maxSeverity?: string;
  ageGating?: { minAge?: number | null; requireGuardianConsent?: boolean };
  allowedRegions?: string[];
  blockedRegions?: string[];
}

export interface RaiOptOut {
  id?: string;
  modelId?: string;
  tenantId?: string;
  reason?: string;
}

export interface RaiUsagePoint {
  date: string;
  calls: number;
  tokens: number;
  costUsd: number;
}

export interface RaiUsageTotals {
  calls: number;
  tokens: number;
  costUsd: number;
}

const SAMPLE_MODELS: RaiModel[] = [
  {
    id: "model-tutor-pro",
    name: "AIVO Tutor Pro",
    provider: "anthropic",
    modality: "text",
    status: "active",
    owner: { team: "Learning Platform", contact: "ml-platform@aivo.example" },
    intendedUse: "K-12 conversational tutoring with curriculum guardrails.",
    outOfScopeUse: "Diagnosing disabilities; grading high-stakes summative exams.",
    currentVersionId: "ver-tutor-2",
    versions: 2,
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "model-speech-eval",
    name: "AIVO Speech Eval",
    provider: "internal",
    modality: "speech",
    status: "active",
    owner: { team: "Speech & Accessibility", contact: "speech@aivo.example" },
    intendedUse: "Pronunciation and reading-fluency scoring for early readers.",
    outOfScopeUse: "Accent or dialect judgement; identity verification.",
    currentVersionId: "ver-speech-1",
    versions: 1,
    updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
];

export async function listModels(opts: { requestId?: string } = {}): Promise<RaiModel[]> {
  const res = await callService<{ models: RaiModel[] }>({
    service: SERVICE,
    baseUrl: base(),
    url: "/api/responsible-ai/models",
    requestId: opts.requestId,
  });
  return res.ok ? res.data.models : SAMPLE_MODELS;
}

export async function getModelCard(
  modelId: string,
  opts: { requestId?: string } = {},
): Promise<{ model: RaiModel | null; card: ModelCardDoc | null; versions: RaiModelVersion[] }> {
  const res = await callService<{
    model: RaiModel;
    card: ModelCardDoc | null;
    versions: RaiModelVersion[];
  }>({
    service: SERVICE,
    baseUrl: base(),
    url: `/api/responsible-ai/models/${encodeURIComponent(modelId)}/card`,
    requestId: opts.requestId,
  });
  if (res.ok) return res.data;
  const model = SAMPLE_MODELS.find((m) => m.id === modelId) ?? null;
  return { model, card: null, versions: [] };
}

export async function listEvals(
  modelId?: string,
  opts: { requestId?: string } = {},
): Promise<RaiEvalRun[]> {
  const qs = modelId ? `?modelId=${encodeURIComponent(modelId)}` : "";
  const res = await callService<{ runs: RaiEvalRun[] }>({
    service: SERVICE,
    baseUrl: base(),
    url: `/api/responsible-ai/evals${qs}`,
    requestId: opts.requestId,
  });
  return res.ok ? res.data.runs : [];
}

export async function listIncidents(opts: { requestId?: string } = {}): Promise<RaiIncident[]> {
  const res = await callService<{ incidents: RaiIncident[] }>({
    service: SERVICE,
    baseUrl: base(),
    url: "/api/responsible-ai/incidents",
    requestId: opts.requestId,
  });
  return res.ok ? res.data.incidents : [];
}

export async function listPolicies(opts: { requestId?: string } = {}): Promise<RaiPolicy[]> {
  const res = await callService<{ policies: RaiPolicy[] }>({
    service: SERVICE,
    baseUrl: base(),
    url: "/api/responsible-ai/policies",
    requestId: opts.requestId,
  });
  return res.ok ? res.data.policies : [];
}

export async function listOptOuts(
  tenantId?: string,
  opts: { requestId?: string } = {},
): Promise<RaiOptOut[]> {
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  const res = await callService<{ optOuts: RaiOptOut[] }>({
    service: SERVICE,
    baseUrl: base(),
    url: `/api/responsible-ai/optouts${qs}`,
    requestId: opts.requestId,
  });
  return res.ok ? res.data.optOuts : [];
}

export async function getUsage(
  modelId?: string,
  tenantId?: string,
  range = "7d",
  opts: { requestId?: string } = {},
): Promise<{ totals: RaiUsageTotals; series: RaiUsagePoint[] }> {
  const params = new URLSearchParams({ range });
  if (modelId) params.set("modelId", modelId);
  if (tenantId) params.set("tenantId", tenantId);
  const res = await callService<{ totals: RaiUsageTotals; series: RaiUsagePoint[] }>({
    service: SERVICE,
    baseUrl: base(),
    url: `/api/responsible-ai/usage?${params.toString()}`,
    requestId: opts.requestId,
  });
  return res.ok ? res.data : { totals: { calls: 0, tokens: 0, costUsd: 0 }, series: [] };
}

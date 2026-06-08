/**
 * In-memory registry store for responsible-ai-svc.
 *
 * responsible-ai-svc has no DB connection of its own (audit is emitted
 * over HTTP). The registry data lives in this process-local store; the
 * authoritative schema is documented in `src/db/migrations/*.sql` and
 * is what a future Postgres-backed implementation will mirror. The
 * store ships deterministic seed fixtures so evals, policy resolution
 * and the admin console are demoable and unit-testable without a DB.
 */
import { randomUUID } from "node:crypto";
import type {
  EvalRun,
  ModelCard,
  ModelRecord,
  ModelVersion,
  OptOut,
  PolicyRecord,
  RaiIncident,
  UsageAggregate,
} from "./types.js";

export interface RegistryStore {
  models: Map<string, ModelRecord>;
  versions: Map<string, ModelVersion>;
  cards: Map<string, ModelCard>;
  policies: Map<string, PolicyRecord>;
  evalRuns: Map<string, EvalRun>;
  incidents: Map<string, RaiIncident>;
  optOuts: Map<string, OptOut>;
  usage: UsageAggregate[];
  /** tenantId → districtId, used by policy resolution. */
  tenantDistrict: Map<string, string>;
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 12)}`;
}

/**
 * Seed tenant → district mapping used by policy resolution and the opt-out
 * cascade. The registry tables (0001 / drizzle 0078) do not model this
 * mapping, so it is kept here as a shared constant and consulted by both the
 * in-memory and Postgres repositories to preserve identical resolution
 * behavior. A future migration can replace this with a real table.
 */
export const SEED_TENANT_DISTRICT: ReadonlyArray<readonly [string, string]> = [
  ["tenant-springfield", "district-springfield"],
  ["tenant-shelbyville", "district-springfield"],
  ["tenant-riverdale", "district-riverdale"],
];

function nowMinus(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export function createSeededStore(): RegistryStore {
  const store: RegistryStore = {
    models: new Map(),
    versions: new Map(),
    cards: new Map(),
    policies: new Map(),
    evalRuns: new Map(),
    incidents: new Map(),
    optOuts: new Map(),
    usage: [],
    tenantDistrict: new Map(SEED_TENANT_DISTRICT.map(([t, d]) => [t, d])),
  };

  // ── Models ────────────────────────────────────────────────────────────
  const tutorModel: ModelRecord = {
    id: "model-tutor-pro",
    name: "AIVO Tutor Pro",
    provider: "anthropic",
    modality: "text",
    status: "active",
    owner: { team: "Learning Platform", contact: "ml-platform@aivo.example" },
    intendedUse: "K-12 conversational tutoring with curriculum guardrails.",
    outOfScopeUse: "Diagnosing disabilities; grading high-stakes summative exams.",
    currentVersionId: "ver-tutor-2",
    createdAt: nowMinus(120),
    updatedAt: nowMinus(3),
  };
  const speechModel: ModelRecord = {
    id: "model-speech-eval",
    name: "AIVO Speech Eval",
    provider: "internal",
    modality: "speech",
    status: "active",
    owner: { team: "Speech & Accessibility", contact: "speech@aivo.example" },
    intendedUse: "Pronunciation and reading-fluency scoring for early readers.",
    outOfScopeUse: "Accent or dialect judgement; identity verification.",
    currentVersionId: "ver-speech-1",
    createdAt: nowMinus(90),
    updatedAt: nowMinus(10),
  };
  const visionModel: ModelRecord = {
    id: "model-math-vision",
    name: "AIVO Math Vision",
    provider: "internal",
    modality: "vision",
    status: "deprecated",
    owner: { team: "Math Tools", contact: "math@aivo.example" },
    intendedUse: "Recognise hand-written math from worksheet photos.",
    outOfScopeUse: "Reading text outside of math notation; facial analysis.",
    currentVersionId: "ver-vision-1",
    createdAt: nowMinus(200),
    updatedAt: nowMinus(40),
  };
  for (const m of [tutorModel, speechModel, visionModel]) store.models.set(m.id, m);

  // ── Versions ──────────────────────────────────────────────────────────
  const versions: ModelVersion[] = [
    {
      id: "ver-tutor-1",
      modelId: "model-tutor-pro",
      version: "1.0.0",
      releasedAt: nowMinus(120),
      changelog: "Initial release.",
      provenanceHash: "sha256:1a2b3c",
    },
    {
      id: "ver-tutor-2",
      modelId: "model-tutor-pro",
      version: "1.1.0",
      releasedAt: nowMinus(3),
      changelog: "Improved refusal calibration; reduced hallucination on dates.",
      provenanceHash: "sha256:4d5e6f",
    },
    {
      id: "ver-speech-1",
      modelId: "model-speech-eval",
      version: "0.9.0",
      releasedAt: nowMinus(90),
      changelog: "Beta fluency scoring.",
      provenanceHash: "sha256:7a8b9c",
    },
    {
      id: "ver-vision-1",
      modelId: "model-math-vision",
      version: "1.0.0",
      releasedAt: nowMinus(200),
      changelog: "Initial release.",
      provenanceHash: "sha256:aabbcc",
    },
  ];
  for (const v of versions) store.versions.set(v.id, v);

  // ── Model cards (NIST AI RMF GOVERN fields) ───────────────────────────
  store.cards.set("model-tutor-pro", {
    modelId: "model-tutor-pro",
    markdown: [
      "# AIVO Tutor Pro — Model Card",
      "",
      "## Overview",
      "Conversational K-12 tutor with curriculum-aligned guardrails and",
      "age-appropriate content filtering.",
      "",
      "## Evaluation",
      "Evaluated on the safety, accuracy, bias, refusal-rate and",
      "hallucination suites. See the Evals tab for the latest run.",
    ].join("\n"),
    metadata: {
      accountableOwner: "Learning Platform — ml-platform@aivo.example",
      riskTier: "high",
      intendedUse: tutorModel.intendedUse,
      outOfScopeUse: tutorModel.outOfScopeUse,
      humanOversight: "Teacher review queue for flagged turns; platform red-team weekly.",
      incidentEscalation: "Sev1/2 page on-call; RAI incident filed within 1h.",
      stakeholders: ["Educators", "Guardians", "District DPOs", "Learners"],
      provenance: "Hosted via anthropic; revision pinned per model_versions.",
      trainingDataSummary: "Vendor foundation model; no learner PII in fine-tuning.",
      knownLimitations: [
        "May over-refuse on legitimate health-curriculum topics.",
        "Date arithmetic beyond 2030 occasionally hallucinated.",
      ],
      euAiActClassification: "High-risk (education access & assessment).",
      lastReviewedAt: nowMinus(3),
    },
  });

  // ── Policies (platform default + one district + one tenant) ───────────
  const policies: PolicyRecord[] = [
    {
      id: "pol-platform-default",
      name: "Platform Default Safety Policy",
      scopeLevel: "platform",
      scopeId: null,
      contentSafety: { blockedCategories: ["violence", "self-harm", "sexual"], maxSeverity: "low" },
      ageGating: { minAge: 5, requireGuardianConsent: true },
      regionRestrictions: { allowedRegions: [], blockedRegions: [] },
      enabled: true,
      updatedAt: nowMinus(60),
      updatedBy: "platform_admin",
    },
    {
      id: "pol-district-springfield",
      name: "Springfield District Policy",
      scopeLevel: "district",
      scopeId: "district-springfield",
      contentSafety: {
        blockedCategories: ["violence", "self-harm", "sexual", "weapons"],
        maxSeverity: "low",
      },
      ageGating: { minAge: 6, requireGuardianConsent: true },
      regionRestrictions: { allowedRegions: ["US"], blockedRegions: [] },
      enabled: true,
      updatedAt: nowMinus(20),
      updatedBy: "platform_admin",
    },
    {
      id: "pol-tenant-springfield",
      name: "Springfield Elementary Policy",
      scopeLevel: "tenant",
      scopeId: "tenant-springfield",
      contentSafety: { blockedCategories: [], maxSeverity: "low" },
      ageGating: { minAge: 7, requireGuardianConsent: true },
      regionRestrictions: { allowedRegions: [], blockedRegions: [] },
      enabled: true,
      updatedAt: nowMinus(5),
      updatedBy: "platform_admin",
    },
  ];
  for (const p of policies) store.policies.set(p.id, p);

  // ── A completed seed eval run ─────────────────────────────────────────
  store.evalRuns.set("run-seed-tutor", {
    id: "run-seed-tutor",
    modelId: "model-tutor-pro",
    harness: "full-suite",
    status: "passed",
    metrics: { safety: 0.98, accuracy: 0.91, bias: 0.96, refusalRate: 0.04, hallucination: 0.03 },
    cases: [
      { id: "c1", metric: "safety", passed: true, score: 0.98 },
      { id: "c2", metric: "accuracy", passed: true, score: 0.91 },
      { id: "c3", metric: "bias", passed: true, score: 0.96 },
    ],
    startedAt: nowMinus(3),
    completedAt: nowMinus(3),
    triggeredBy: "platform_admin",
  });

  // ── Usage aggregates (last 7 days) ────────────────────────────────────
  for (let d = 0; d < 7; d++) {
    store.usage.push({
      modelId: "model-tutor-pro",
      tenantId: "tenant-springfield",
      date: nowMinus(d).slice(0, 10),
      calls: 1200 - d * 40,
      tokens: 480_000 - d * 12_000,
      costUsd: Number((9.6 - d * 0.24).toFixed(2)),
    });
  }

  return store;
}

let singleton: RegistryStore | null = null;
export function getStore(): RegistryStore {
  if (!singleton) singleton = createSeededStore();
  return singleton;
}
/** Test helper: reset the singleton to a fresh seeded store. */
export function resetStore(): RegistryStore {
  singleton = createSeededStore();
  return singleton;
}
